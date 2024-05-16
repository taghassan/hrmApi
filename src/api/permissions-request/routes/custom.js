module.exports= {
    routes: [

      {
        method: 'GET',
        path: '/permissions',
        handler: 'permissions-request.find',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/permissions/status',
        handler: 'permissions-request.getPermissionStatus',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },

    ]

}
