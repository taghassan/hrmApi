module.exports = {

  async getPermissions(ctx) {
    const {status} = ctx.request.query;

    let permissionsData = [
      {
        status: 'approved',
        type: 'medical',
        isStartOfDay: true,
        date: new Date(),
        notes: 'Lorem ipsum'
      },
      {
        status: 'pending',
        type: 'official',
        isStartOfDay: false,
        date: new Date(),
        notes: 'Dolor sit amet'
      }
    ];

    if (status && status === 'approved') {
      return ctx.body = permissionsData.filter(data => data.status === 'approved');
    } else {
      return ctx.body = permissionsData;
    }

  }
  , async getPermissionStatus(ctx) {
    let permissionsStatus = {
      private: 10,
      medical: 5,
      official: 8,
      others: 15
    };

    return ctx.body = permissionsStatus;
  }
}
