module.exports= {
    routes: [
        {
          method: 'POST',
          path: '/attendance/check_out',
          handler: 'attendance.checkOut',
        },
      {
        method: 'POST',
        path: '/attendance/check_in',
        handler: 'attendance.checkIn',
      },
      {
        method: 'GET',
        path: '/attendance/current_server_time',
        handler: 'attendance.currentServerTime',
      },
      {
        method: 'GET',
        path: '/attendance/attendance_history',
        handler: 'attendance.attendanceHistory',
      },
      {
        method: 'GET',
        path: '/attendance/recent_actions',
        handler: 'attendance.recentActions',
      },
      {
        method: 'GET',
        path: '/attendance/get_branch_details',
        handler: 'attendance.getBranchDetails',
      },
      {
        method: 'GET',
        path: '/attendance/get_branch_details/:branch_id',
        handler: 'attendance.getBranchDetailsById',
      },
      {
        method: 'GET',
        path: '/attendance/get_user_details',
        handler: 'attendance.getUserDetails',
      },
      {
        method: 'GET',
        path: '/attendance/shifts',
        handler: 'attendance.shifts',
      }
    ]

}
