// backend/src/extensions/users-permissions/strapi-server.js
"use strict";

const crypto = require("crypto");

const {concat, compact, isArray, pipe, castArray, every} = require("lodash/fp");

const {
  contentTypes: {getNonWritableAttributes},
} = require("@strapi/utils");

const _ = require("lodash");
const jwt = require("jsonwebtoken");
const utils = require("@strapi/utils");

const {UserSchema} = require("../../Validation/index"); // Importing UserSchema

const {getAbsoluteAdminUrl, getAbsoluteServerUrl, sanitize} = utils;
const {ApplicationError, ValidationError, ForbiddenError} = utils.errors;

const {
  validateCallbackBody,
  validateRegisterBody,
  validateSendEmailConfirmationBody,
  validateForgotPasswordBody,
  validateResetPasswordBody,
  validateEmailConfirmationBody,
  validateChangePasswordBody,
} = require("./validation/auth");

const {getService} = require("./utils");
const {mapUserWithSift} = require("../../api/app_utils");

const sanitizeUser = (user, ctx) => {
  // Sanitizing user
  const {auth} = ctx.state;
  const userSchema = strapi.getModel("plugin::users-permissions.user");
  return sanitize.contentAPI.output(user, userSchema, {auth});
};

async function updateTokenOnUser(user, jwt) {

  if (user && user.id)
    await strapi.query("plugin::users-permissions.user").update({
      where: {id: user.id},
      data: {
        authorization: jwt
      },
    });

}

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

    const settings = await pluginStore.get({key: "advanced"});

    if (!settings.allow_register) {
      throw new ApplicationError("Register action is currently disabled");
    }

    const {register} = strapi.config.get("plugin.users-permissions");
    const alwaysAllowedKeys = ["username", "password", "email"];
    const userModel = strapi.contentTypes["plugin::users-permissions.user"];
    const {attributes} = userModel;

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
      .findOne({where: {type: settings.default_role}});

    if (!role) {
      throw new ApplicationError("Impossible to find the default role");
    }

    const {email, username, provider} = params;

    const identifierFilter = {
      $or: [
        {email: email.toLowerCase()},
        {username: email.toLowerCase()},
        {username},
        {email: username},
      ],
    };

    const conflictingUserCount = await strapi
      .query("plugin::users-permissions.user")
      .count({
        where: {...identifierFilter, provider},
      });

    if (conflictingUserCount > 0) {
      throw new ApplicationError("Email or Username are already taken");
    }

    if (settings.unique_email) {
      const conflictingUserCount = await strapi
        .query("plugin::users-permissions.user")
        .count({
          where: {...identifierFilter},
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

    user.photo = 'https://media.istockphoto.com/id/1214428300/vector/default-profile-picture-avatar-photo-placeholder-vector-illustration.jpg?s=612x612&w=0&k=20&c=vftMdLhldDx9houN4V-g3C9k0xl6YeBcoB_Rk6Trce0='

    const sanitizedUser = await sanitizeUser(user, ctx);

    if (settings.email_confirmation) {
      try {
        await getService("user").sendConfirmationEmail(sanitizedUser);
      } catch (err) {
        throw new ApplicationError(err.message);
      }

      return ctx.send({user: sanitizedUser});
    }
    const jwt = getService("jwt").issue(_.pick(user, ["id"]));
    await updateTokenOnUser(user, jwt)
    return ctx.send({
      jwt,
      user: sanitizedUser,
    });
  };

  // Login controller override
  plugin.controllers.auth.callback = async (ctx) => {
    const provider = ctx.params.provider || "local";
    const params = ctx.request.body;
    const {withShift} = ctx.request.query;

    const store = strapi.store({type: "plugin", name: "users-permissions"});
    const grantSettings = await store.get({key: "grant"});

    const grantProvider = provider === "local" ? "email" : provider;

    if (!_.get(grantSettings, [grantProvider, "enabled"])) {
      throw new ApplicationError("This provider is disabled");
    }

    if (provider === "local") {
      await validateCallbackBody(params);

      const {identifier, idn, uuid, sub} = params;

      // Check if the user exists.
      let user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            provider,
            $or: [
              {email: identifier.toLowerCase()},
              {username: identifier},
              {EmployeeNumber: identifier},
              {Phone: identifier},
            ],
          },
          populate: {
            shift: {
              populate: {
                days: {
                  populate: {
                    day: true,
                  }
                }
              }
            },
            Photo: true
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
          where: {id: user.id},
          data: {
            idn: idn,
            uuid: uuid,
            sub: sub,
          },
        });
      }

      const advancedSettings = await store.get({key: "advanced"});
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

      let shift = null
      if (user && withShift === 'true') {

        user = mapUserWithSift(user)
        shift = user.shift
      } else {
        delete user.shift;
      }

      if (user.Photo) {
        user.photo = `https://strapi.syscodeia.ae${user.Photo.url ?? ''}`
        delete user.Photo;
      } else {
        user.photo = 'https://media.istockphoto.com/id/1214428300/vector/default-profile-picture-avatar-photo-placeholder-vector-illustration.jpg?s=612x612&w=0&k=20&c=vftMdLhldDx9houN4V-g3C9k0xl6YeBcoB_Rk6Trce0='
      }
      const jwt = getService("jwt").issue({id: user.id});
      await updateTokenOnUser(user, jwt)
      return ctx.send({
        jwt: jwt,
        user: await sanitizeUser(user, ctx),
        shift: shift ?? null,
        message: "login successfully",
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

      const jwt = getService("jwt").issue({id: user.id});
      await updateTokenOnUser(user, jwt)
      return ctx.send({
        ok: true,
        jwt:jwt,
        user: await sanitizeUser(user, ctx),
      });
    } catch (error) {
      throw new ApplicationError(error.message);
    }
  };

  plugin.controllers.auth.changePassword = async (ctx) => {
    if (!ctx.state.user) {
      throw new ApplicationError(
        "You must be authenticated to reset your password"
      );
    }

    const {currentPassword, password} = await validateChangePasswordBody(
      ctx.request.body
    );

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      ctx.state.user.id
    );

    const validPassword = await getService("user").validatePassword(
      currentPassword,
      user.password
    );

    if (!validPassword) {
      throw new ValidationError("The provided current password is invalid");
    }

    if (currentPassword === password) {
      throw new ValidationError(
        "Your new password must be different than your current password"
      );
    }

    await getService("user").edit(user.id, {password});

    const jwt = getService("jwt").issue({id: user.id});
    await updateTokenOnUser(user, jwt)

    ctx.send({
      ok: true,
      jwt: jwt,
      user: await sanitizeUser(user, ctx),
      message: "Password changed successfully",
    });
  };

  plugin.controllers.auth.forgotPassword = async (ctx) => {
    const {identifier} = await validateForgotPasswordBody(ctx.request.body);

    // Find the user by identifier.
    const user = await strapi.query("plugin::users-permissions.user").findOne({
      where: {
        $or: [
          {email: identifier.toLowerCase()},
          {username: identifier},
          {EmployeeNumber: identifier},
          {Phone: identifier},
        ],
      },
    });

    if (!user || user.blocked) {
      return ctx.send({
        ok: false,
        message: "user not found or blocked",
      });
    }

    // Generate random token.
    const userInfo = await sanitizeUser(user, ctx);

    // const resetPasswordToken = crypto.randomBytes(64).toString('hex');

    //TODO
    // const resetPasswordToken = Math.floor(100000 + Math.random() * 900000);
    const resetPasswordToken = 123456;

    // NOTE: Update the user before sending the email so an Admin can generate the link if the email fails
    await getService("user").edit(user.id, {
      resetPasswordToken: `${resetPasswordToken}`,
    });

    //TODO Send Code in sms

    ctx.send({
      ok: true,
      resetPasswordToken: resetPasswordToken,
      message: "OTP sent to your phone number",
    });
  };

  plugin.controllers.auth.resetPassword = async (ctx) => {
    const {password, passwordConfirmation, code, identifier} =
      await validateResetPasswordBody(ctx.request.body);

    if (password !== passwordConfirmation) {
      throw new ValidationError("Passwords do not match");
    }

    const user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({
        where: {
          resetPasswordToken: code,
          $or: [
            {email: identifier.toLowerCase()},
            {username: identifier},
            {EmployeeNumber: identifier},
            {Phone: identifier},
          ],
        },
      });

    if (!user) {
      throw new ValidationError("Incorrect code or identifier provided");
    }

    await getService("user").edit(user.id, {
      resetPasswordToken: null,
      password,
    });

    const jwt = getService("jwt").issue({id: user.id});
    await updateTokenOnUser(user, jwt)
    // Update the user.
    ctx.send({
      ok: true,
      jwt: jwt,
      user: await sanitizeUser(user, ctx),
      message: "Password reseted successfully",
    });
  };

  plugin.controllers.auth.validateCode = async (ctx) => {
    const {code, identifier} = ctx.request.body;

    if (!code) {
      throw new ValidationError("Incorrect code provided");
    }

    if (!identifier) {
      throw new ValidationError("Incorrect identifier provided");
    }

    const user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({
        where: {
          resetPasswordToken: code,
          $or: [
            {email: identifier.toLowerCase()},
            {username: identifier},
            {EmployeeNumber: identifier},
            {Phone: identifier},
          ],
        },
      });

    if (!user) {
      throw new ValidationError("Incorrect user code provided");
    }

    ctx.send({
      ok: true,
      message: "OTP is validate",
    });
  };

  //logout
  plugin.controllers.auth.logout = async (ctx) => {

    const user =ctx.state.user
    if(!user){
      return ctx.unauthorized("This action is unauthorized.");
    }else{
    await  updateTokenOnUser(user,'')
     return  ctx.send({
        ok: true,
        message: "logout successfully!",
      });
    }

  }

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
    path: "/auth/local/register",
    handler: "auth.register",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  plugin.routes["content-api"].routes.unshift({
    // Adding route
    method: "POST",
    path: "/auth/local/forgotPassword",
    handler: "auth.forgotPassword",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  plugin.routes["content-api"].routes.unshift({
    // Adding route
    method: "POST",
    path: "/auth/local/validateCode",
    handler: "auth.validateCode",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  plugin.routes["content-api"].routes.unshift({
    // Adding route
    method: "POST",
    path: "/auth/local/resetPassword",
    handler: "auth.resetPassword",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  plugin.routes["content-api"].routes.unshift({
    // Adding route
    method: "POST",
    path: "/auth/local/changePassword",
    handler: "auth.changePassword",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  plugin.routes["content-api"].routes.unshift({
    // Adding route
    method: "POST",
    path: "/auth/local/logout",
    handler: "auth.logout",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  return plugin;
};
