// backend/src/extensions/users-permissions/strapi-server.js
"use strict";

const crypto = require("crypto");

const { concat, compact, isArray } = require("lodash/fp");

const {
  contentTypes: { getNonWritableAttributes },
} = require("@strapi/utils");

const _ = require("lodash");
const jwt = require("jsonwebtoken");
const utils = require("@strapi/utils");

const { UserSchema } = require("../../Validation/index"); // Importing UserSchema

const { getAbsoluteAdminUrl, getAbsoluteServerUrl, sanitize } = utils;
const { ApplicationError, ValidationError, ForbiddenError } = utils.errors;

const {
  validateCallbackBody,
  validateRegisterBody,
  validateSendEmailConfirmationBody,
  validateForgotPasswordBody,
  validateResetPasswordBody,
  validateEmailConfirmationBody,
  validateChangePasswordBody,
} = require("./validation/auth");

const { getService } = require("./utils");

const sanitizeUser = (user, ctx) => {
  // Sanitizing user
  const { auth } = ctx.state;
  const userSchema = strapi.getModel("plugin::users-permissions.user");
  return sanitize.contentAPI.output(user, userSchema, { auth });
};
module.exports = (plugin) => {
  // JWT issuer
  const issue = (payload, jwtOptions = {}) => {
    _.defaults(jwtOptions, strapi.config.get("plugin.users-permissions.jwt"));
    return jwt.sign(
      _.clone(payload.toJSON ? payload.toJSON() : payload),
      strapi.config.get("plugin.users-permissions.jwtSecret"),
      jwtOptions
    );
  };
  //   Register controller override
  plugin.controllers.auth.register = async (ctx) => {
    // The logic for the register route

    const pluginStore = await strapi.store({
      type: "plugin",
      name: "users-permissions",
    });

    const settings = await pluginStore.get({ key: "advanced" });

    if (!settings.allow_register) {
      throw new ApplicationError("Register action is currently disabled");
    }

    const { register } = strapi.config.get("plugin.users-permissions");
    const alwaysAllowedKeys = ["username", "password", "email"];
    const userModel = strapi.contentTypes["plugin::users-permissions.user"];
    const { attributes } = userModel;

    const nonWritable = getNonWritableAttributes(userModel);

    const allowedKeys = compact(
      concat(
        alwaysAllowedKeys,
        isArray(register?.allowedFields)
          ? // Note that we do not filter allowedFields in case a user explicitly chooses to allow a private or otherwise omitted field on registration
            register.allowedFields // if null or undefined, compact will remove it
          : // to prevent breaking changes, if allowedFields is not set in config, we only remove private and known dangerous user schema fields
            // TODO V5: allowedFields defaults to [] when undefined and remove this case
            Object.keys(attributes).filter(
              (key) =>
                !nonWritable.includes(key) &&
                !attributes[key].private &&
                ![
                  // many of these are included in nonWritable, but we'll list them again to be safe and since we're removing this code in v5 anyway
                  // Strapi user schema fields
                  "confirmed",
                  "blocked",
                  "confirmationToken",
                  "resetPasswordToken",
                  "provider",
                  "id",
                  "role",
                  // other Strapi fields that might be added
                  "createdAt",
                  "updatedAt",
                  "createdBy",
                  "updatedBy",
                  "publishedAt", // d&p
                  "strapi_reviewWorkflows_stage", // review workflows
                ].includes(key)
            )
      )
    );

    const params = {
      ..._.pick(ctx.request.body, allowedKeys),
      provider: "local",
    };

    await validateRegisterBody(params);

    const role = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: settings.default_role } });

    if (!role) {
      throw new ApplicationError("Impossible to find the default role");
    }

    const { email, username, provider } = params;

    const identifierFilter = {
      $or: [
        { email: email.toLowerCase() },
        { username: email.toLowerCase() },
        { username },
        { email: username },
      ],
    };

    const conflictingUserCount = await strapi
      .query("plugin::users-permissions.user")
      .count({
        where: { ...identifierFilter, provider },
      });

    if (conflictingUserCount > 0) {
      throw new ApplicationError("Email or Username are already taken");
    }

    if (settings.unique_email) {
      const conflictingUserCount = await strapi
        .query("plugin::users-permissions.user")
        .count({
          where: { ...identifierFilter },
        });

      if (conflictingUserCount > 0) {
        throw new ApplicationError("Email or Username are already taken");
      }
    }

    const newUser = {
      ...params,
      role: role.id,
      email: email.toLowerCase(),
      username,
      confirmed: !settings.email_confirmation,
    };

    const user = await getService("user").add(newUser);

    const sanitizedUser = await sanitizeUser(user, ctx);

    if (settings.email_confirmation) {
      try {
        await getService("user").sendConfirmationEmail(sanitizedUser);
      } catch (err) {
        throw new ApplicationError(err.message);
      }

      return ctx.send({ user: sanitizedUser });
    }
    const jwt = getService("jwt").issue(_.pick(user, ["id"]));

    return ctx.send({
      jwt,
      user: sanitizedUser,
    });
  };

  // Login controller override
  plugin.controllers.auth.callback = async (ctx) => {
    const provider = ctx.params.provider || "local";
    const params = ctx.request.body;

    const store = strapi.store({ type: "plugin", name: "users-permissions" });
    const grantSettings = await store.get({ key: "grant" });

    const grantProvider = provider === "local" ? "email" : provider;

    if (!_.get(grantSettings, [grantProvider, "enabled"])) {
      throw new ApplicationError("This provider is disabled");
    }

    if (provider === "local") {
      await validateCallbackBody(params);

      const { identifier, idn, uuid, sub } = params;

      // Check if the user exists.
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            provider,
            $or: [
              { email: identifier.toLowerCase() },
              { username: identifier },
              { EmployeeNumber: identifier },
              { Phone: identifier },
            ],
          },
        });

      if (!user) {
        throw new ValidationError("Invalid identifier or password");
      }

      if (!uuid) {
        if (!user.password) {
          throw new ValidationError("Invalid identifier or password");
        }

        const validPassword = await getService("user").validatePassword(
          params.password,
          user.password
        );

        if (!validPassword) {
          throw new ValidationError("Invalid identifier or password");
        }
      } else {
        await strapi.query("plugin::users-permissions.user").update({
          where: { id: user.id },
          data: {
            idn: idn,
            uuid: uuid,
            sub: sub,
          },
        });
      }

      const advancedSettings = await store.get({ key: "advanced" });
      const requiresConfirmation = _.get(
        advancedSettings,
        "email_confirmation"
      );

      if (requiresConfirmation && user.confirmed !== true) {
        throw new ApplicationError("Your account email is not confirmed");
      }

      if (user.blocked === true) {
        throw new ApplicationError(
          "Your account has been blocked by an administrator"
        );
      }

      return ctx.send({
        jwt: getService("jwt").issue({ id: user.id }),
        user: await sanitizeUser(user, ctx),
      });
    }

    // Connect the user with the third-party provider.
    try {
      const user = await getService("providers").connect(provider, ctx.query);

      if (user.blocked) {
        throw new ForbiddenError(
          "Your account has been blocked by an administrator"
        );
      }

      return ctx.send({
        jwt: getService("jwt").issue({ id: user.id }),
        user: await sanitizeUser(user, ctx),
      });
    } catch (error) {
      throw new ApplicationError(error.message);
    }
  };

  plugin.routes["content-api"].routes.unshift({
    // Adding route
    method: "POST",
    path: "/auth/local", // Login route
    handler: "auth.callback",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  plugin.routes["content-api"].routes.unshift({
    // Adding route
    method: "POST",
    path: "/auth/local/register", // Register route
    handler: "auth.register",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });
  return plugin;
};
