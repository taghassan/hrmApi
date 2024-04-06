module.exports= {
    routes: [
        {
          method: 'POST',
          path: '/attendance/check_out',
          handler: 'attendance.checkOut',
          config: {
            middlewares: ["api::attendance.auth"],
          }
        },
      {
        method: 'POST',
        path: '/attendance/check_in',
        handler: 'attendance.checkIn',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/attendance/current_server_time',
        handler: 'attendance.currentServerTime',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/attendance/attendance_history',
        handler: 'attendance.attendanceHistory',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/attendance/recent_actions',
        handler: 'attendance.recentActions',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/attendance/get_branch_details',
        handler: 'attendance.getBranchDetails',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/attendance/get_branch_details/:branch_id',
        handler: 'attendance.getBranchDetailsById',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/attendance/get_user_details',
        handler: 'attendance.getUserDetails',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/attendance/shifts',
        handler: 'attendance.shifts',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/attendance/getUserShift',
        handler: 'attendance.getUserShift',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      },
      {
        method: 'GET',
        path: '/attendance/get-attendance-report',
        handler: 'attendance.getAttendanceReport',
        config: {
          middlewares: ["api::attendance.auth"],
        }
      }
    ]

}
