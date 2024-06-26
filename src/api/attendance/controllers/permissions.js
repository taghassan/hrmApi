const {UnifiedResponse} = require("../../app_utils");
module.exports = {

  async getPermissions(ctx) {
    const {status} = ctx.request.query;

    let permissionsData = [
      {
        id:1,
        status: 'pending',
        type: 'official',
        isStartOfDay: false,
        date: new Date(),
        notes: 'Dolor sit amet'
      },
      {
        id:2,
        status: 'approved',
        type: 'medical',
        isStartOfDay: true,
        date: new Date(),
        notes: 'Lorem ipsum'
      },
      {
        id:3,
        status: 'pending',
        type: 'official',
        isStartOfDay: false,
        date: new Date(),
        notes: 'Dolor sit amet'
      },
      {
        id:4,
        status: 'approved',
        type: 'medical',
        isStartOfDay: true,
        date: new Date(),
        notes: 'Lorem ipsum'
      },
    ];

    if (status) {
     return new UnifiedResponse(true,permissionsData.filter(data => data.status === `${status}`),'')

    } else {
      return new UnifiedResponse(
        true,
        permissionsData,
        'executed successfully !'
      )

    }

  }
  , async getPermissionStatus(ctx) {
    let permissionsStatus = {
      private: 10,
      medical: 5,
      official: 8,
      others: 15
    };

    return new UnifiedResponse(
      true,
      permissionsStatus,
      'executed successfully !'
    )

  }
}
