'use strict';

const {UnifiedResponse} = require("../../app_utils");
/**
 * rules-and-policie controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::rules-and-policie.rules-and-policie',({strapi})=>({
  async find(ctx) {
    const results = await super.find(ctx);
    const sanitizedResults = await this.sanitizeOutput(results, ctx);

    return ctx.send(
      new UnifiedResponse(
        true,
        sanitizedResults,
        'executed successfully !'
      )
    )

  }
}));
