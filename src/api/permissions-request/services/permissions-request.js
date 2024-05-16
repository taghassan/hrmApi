'use strict';

/**
 * permissions-request service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::permissions-request.permissions-request');
