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
      // await validateCallbackBody(params);

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
