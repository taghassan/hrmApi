'use strict';

/**
 * shift service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::shift.shift');
