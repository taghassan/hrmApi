'use strict';

const {UnifiedResponse} = require("../../app_utils");
/**
 * permissions-request controller
 */

const {createCoreController} = require('@strapi/strapi').factories;

module.exports = createCoreController('api::permissions-request.permissions-request', ({strapi}) => ({

  async find(ctx) {
    const {status} = ctx.request.query;


    if (status) {
      const user = ctx.state.user;
      ctx.query.filters = {
        ...ctx.query.filters,
        ...{status: status,},
      }
    }

    const results = await super.find(ctx);

    const permissionsData = (results.data ?? []).map((item) => {
      return {
        id: item.id,
        status: `${item.status}`,
        type: `${item.type}`,
        isStartOfDay: item.isStartOfDay,
        date: item && new Date(item?.date).toISOString(),
        notes: item.reason
      }
    })


    return new UnifiedResponse(
      true,
      permissionsData,
      'executed successfully !'
    )

  },
  async create(ctx) {
    const user = ctx.state.user;
    const entry = await super.create(ctx);
    await strapi.entityService.update('api::permissions-request.permissions-request', entry.data.id, {
      data: {
        user: user.id
      },
    });

    return new UnifiedResponse(
      true,
      entry.data,
      'executed successfully !'
    )
  },
  async getPermissionStatus(ctx) {
    const user = ctx.state.user;
    let permissionsStatus = {
      private: 0,
      medical: 0,
      official: 0,
      others: 0
    };

    for (const item of ['private', 'medical', 'official', 'others']) {

      permissionsStatus[item] = await strapi.db.query('api::permissions-request.permissions-request').count({
        where: {
          type: `${item}`,
          user: user.id
        }
      })

    }


    return new UnifiedResponse(
      true,
      permissionsStatus,
      'executed successfully !'
    )
  }

}));
