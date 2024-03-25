'use strict';

const url = require('url');
const {validateCheckINOutBody} = require("./Validation");
const utils = require("@strapi/utils");
const {mapUserWithSift, mapShiftDays} = require("../../app_utils");

const {ApplicationError, ValidationError, ForbiddenError} = utils.errors;
const { eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } = require('date-fns');

/**
 * attendance controller
 */

const {createCoreController} = require('@strapi/strapi').factories;

function formatDate(currentTime, isTimeFormat) {
  const year = currentTime.getFullYear();
  const month = String(currentTime.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so we add 1
  const day = String(currentTime.getDate()).padStart(2, '0');

  const hours = String(currentTime.getHours()).padStart(2, '0');
  const minutes = String(currentTime.getMinutes()).padStart(2, '0');
  const seconds = String(currentTime.getSeconds()).padStart(2, '0');
  const milliseconds = String(currentTime.getMilliseconds()).padStart(3, '0');

  return isTimeFormat ? `${hours}:${minutes}:${seconds}.${milliseconds}` : `${year}-${month}-${day}`
}

async function getUserBranch(user) {

  return await strapi.db.query('plugin::users-permissions.user').findOne({
    where: {
      $or: [
        {id: user.id},
      ],
    },
    populate: true,
  });
}

async function getUserShift(user) {

  return await strapi.db.query('plugin::users-permissions.user').findOne({
    where: {
      $or: [
        {id: user.id},
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
      }
    },
  })

}

async function getBranch(branch_id) {
  return await strapi.db.query('api::branch.branch').findOne({
    where: {
      $or: [
        {id: branch_id},
      ],
    },
  });
}

module.exports = createCoreController('api::attendance.attendance', ({strapi}) => ({

  async checkOut(ctx) {
    const {current_lat, current_lang, actionDate, time} = await validateCheckINOutBody(ctx.request.body)
    const user = ctx.state.user;
    const currentTime = new Date();

    const entry = await strapi
      .service("api::attendance.attendance")
      .create(
        {
          "data": {
            "type": "checkOut",
            "date": actionDate ?? currentTime,
            "time": time ?? currentTime,
            "user": user.id,
            "latitude": current_lat ?? '0.0',
            "longitude": current_lang ?? '0.0'
          }
        }
      );

    ctx.send({
      ok: true,
      current_time: formatDate(currentTime, true),
      current_date: formatDate(currentTime, false),
      message: 'Check Out successfully !'
    })
  },

  async checkIn(ctx) {
    const {current_lat, current_lang, actionDate, time} = await validateCheckINOutBody(ctx.request.body)
    const user = ctx.state.user;
    const currentTime = new Date();
    const userWithBranch = await getUserBranch(user)
    const branch = userWithBranch.branch

    await strapi
      .service("api::attendance.attendance")
      .create(
        {
          "data": {
            "type": "checkIn",
            "date": actionDate ?? currentTime,
            "time": time ?? currentTime,
            "user": user.id,
            "latitude": current_lat ?? '0.0',
            "longitude": current_lang ?? '0.0'
          }
        }
      );

    ctx.send({
      ok: true,
      current_time: formatDate(currentTime, true),
      current_date: formatDate(currentTime, false),
      branch_name: branch ? branch.name : '',
      message: 'Check In successfully !'
    })
  },

  async currentServerTime(ctx) {
    const currentTime = new Date();
    ctx.send(
      {
        ok: true,
        current_time: currentTime,
        message: 'executed successfully !'
      }
    )
  },

  async attendanceHistory(ctx) {
    const user = ctx.state.user;

    const entries = await strapi
      .service("api::attendance.attendance").find({
        where: {
          $and: [
            {
              user: user.id
            }
          ]
        }
      })

    // Group data by date
    const groupedData = entries.results.reduce((acc, item) => {
      const date = item.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push({
        type: item.type,
        check_in_time: item.type === 'checkIn' ? item.time : null,
        check_out_time: item.type === 'checkOut' ? item.time : null
      });
      return acc;
    }, {});

    ctx.send(
      {
        ok: true,
        entries: groupedData,
        pagination: entries.pagination,
        message: 'executed successfully !'
      }
    )
  },

  async recentActions(ctx) {

    const user = ctx.state.user;


    const lastCheckin = await strapi.entityService.findMany("api::attendance.attendance", {
      filters: {
        $and: [
          {
            user: user.id
          },
          {
            type: 'checkIn'
          },

        ]
      },
      sort: {id: 'desc'},
      limit: 1,
    });

    const lastCheckOut = await strapi.entityService.findMany("api::attendance.attendance", {
      filters: {
        $and: [
          {
            user: user.id
          },
          {
            type: 'checkOut'
          },

        ]
      },
      sort: {id: 'desc'},
      limit: 1,
    });
    const lastCheckinDatetime = lastCheckin[0] ? '' + lastCheckin[0].date + ' ' + lastCheckin[0].time : ''
    const lastCheckOutDatetime = lastCheckOut[0] ? '' + lastCheckOut[0].date + ' ' + lastCheckOut[0].time : ''


    ctx.send(
      {
        ok: true,
        // lastCheckin: lastCheckin[0] ?? null,
        // lastCheckOut: lastCheckOut[0] ?? null,
        last_checkin_datetime: lastCheckinDatetime,
        last_checkout_datetime: lastCheckOutDatetime,
        message: 'executed successfully !'
      }
    )

  },

  async getBranchDetails(ctx) {
    const user = ctx.state.user;
    const userWithBranch = await getUserBranch(user)
    const branch = userWithBranch.branch
    if (!branch)
      throw new ApplicationError("branch not found");

    ctx.send({
      id: branch.id,
      latitude: branch.latitude ?? '0.0',
      longitude: branch.longitude ?? '0.0',
      checkin_range_radius: branch.checkin_range_radius,
      name: branch.name,
    })

  },
  async getBranchDetailsById(ctx) {
    const {branch_id} = ctx.params
    if (!branch_id)
      return ctx.send({
        ok: false,
        message: "branch_id is required",
      });

    const user = ctx.state.user;
    const branch = await getBranch(branch_id)

    if (!branch)
      throw new ApplicationError("branch not found");

    ctx.send({
      id: branch.id,
      latitude: branch.latitude ?? '0.0',
      longitude: branch.longitude ?? '0.0',
      checkin_range_radius: branch.checkin_range_radius,
      name: branch.name,
    })

  },
  async getUserDetails(ctx) {

    const {withShift} = ctx.request.query;

    const user = ctx.state.user;
    const userWithBranch = await getUserBranch(user)
    const branch = userWithBranch.branch

    let shift = null
    if (withShift === 'true') {
      const userWithShift = await getUserShift(user)
      const mapUserWithShift = mapUserWithSift(userWithShift)
      shift = mapUserWithShift.shift
    }

    ctx.send({
      name: user.NameAr,
      NameEn: user.NameEn,
      NameAr: user.NameAr,
      email: user.email,
      branch_id: branch ? branch.id ?? 0 : null,

      image: userWithBranch.Photo ? userWithBranch.Photo.url : '',
      shift: shift ?? null
    })

  },

  async shifts(ctx) {

    const today = new Date();
    const options = {weekday: 'long'};
    const humanReadableDay = today.toLocaleDateString('en-US', options);

    const entries = await strapi
      .query("api::shift.shift").findMany({
        populate: {
          days: {
            populate: {
              day: {
                // where:{
                //   day:humanReadableDay
                // }
              },
              // fields: ['id','day','code'],
            }
          }
        },
      })


    const dayToDay = await strapi
      .query("api::day.day").findOne({
        where: {
          day: humanReadableDay
        }
      })

    entries.map(entry => {
      entry = mapShiftDays(entry)
    })

    ctx.send(
      {
        ok: true,
        entries: entries,
        message: 'executed successfully !'
      }
    )
  },

  async getUserShift(ctx) {
    const user = ctx.state.user;

    const userWithSift = await getUserShift(user)

    const mappedUserWithSift = mapUserWithSift(userWithSift)

    delete mappedUserWithSift.password;
    delete mappedUserWithSift.resetPasswordToken;
    delete mappedUserWithSift.confirmationToken;

    ctx.send({
      ok: true,
      data: mappedUserWithSift,
      message: 'executed successfully !'
    })
  },
  async getAttendanceReport(ctx) {

    const checkInsAndOuts = [
      {
        "type": "checkIn",
        "date": "2024-02-21",
        "check_in_time": "09:00:00.000",
        "check_out_time": null
      },
      {
        "type": "checkIn",
        "date": "2024-02-22",
        "check_in_time": "09:00:00.000",
        "check_out_time": null
      },
      {
        "type": "checkOut",
        "date": "2024-02-22",
        "check_in_time": null,
        "check_out_time": "12:00:00.000"
      },
      {
        "type": "checkIn",
        "date": "2024-02-23",
        "check_in_time": "13:00:00.000",
        "check_out_time": null
      },
      {
        "type": "checkIn",
        "date": "2024-02-24",
        "check_in_time": "13:00:00.000",
        "check_out_time": null
      },
      {
        "type": "checkOut",
        "date": "2024-02-24",
        "check_in_time": null,
        "check_out_time": "17:00:00.000"
      },
      {
        "type": "checkIn",
        "date": "2024-02-25",
        "check_in_time": "09:30:00.000",
        "check_out_time": null
      },
      {
        "type": "checkOut",
        "date": "2024-02-25",
        "check_in_time": null,
        "check_out_time": "16:30:00.000"
      },
      {
        "type": "checkIn",
        "date": "2024-02-26",
        "check_in_time": "09:30:00.000",
        "check_out_time": null
      },
      {
        "type": "checkIn",
        "date": "2024-02-27",
        "check_in_time": "09:30:00.000",
        "check_out_time": null
      }
    ];

let data=[]
// Function to calculate working hours
    function calculateWorkingHours(checkInsAndOuts) {
      let totalHours = 0;

      const groupedByDate = groupBy(checkInsAndOuts, 'date');

      for (const date in groupedByDate) {
        const entries = groupedByDate[date];

        let checkOutCount = 0;

        for (let i = 0; i < entries.length; i++) {
          // data.push({data:date,type:entries[i].type,i:i})
          if (entries[i].type === 'checkOut') {

            checkOutCount++;
            if (checkOutCount === 1) {
              const checkInTime = new Date(date + 'T' + entries[i - 1].check_in_time);
              const checkOutTime = new Date(date + 'T' + entries[i].check_out_time);
              const diff = (checkOutTime - checkInTime) / (1000 * 60 * 60); // Difference in hours
              totalHours += diff;
            }
          } else if (entries[i].type === 'checkIn') {
            if (checkOutCount === 0) {
              // If no check-out for the check-in, consider the current time
              const currentTime = new Date();
              const checkInTime = new Date(date + 'T' + entries[i].check_in_time);
              const diff = (currentTime - checkInTime) / (1000 * 60 * 60); // Difference in hours
              totalHours += diff;
            }
          }
        }

      }

      return totalHours;
    }

// Function to calculate working days
    function calculateWorkingDays(checkInsAndOuts) {
      // Count unique dates
      const uniqueDates = new Set(checkInsAndOuts.map(entry => entry.date));
      return uniqueDates.size;
    }

// Utility function to group array of objects by a key
    function groupBy(arr, key) {
      return arr.reduce((acc, obj) => {
        const groupKey = obj[key];
        acc[groupKey] = acc[groupKey] || [];
        acc[groupKey].push(obj);
        return acc;
      }, {});
    }

    const workingHours = calculateWorkingHours(checkInsAndOuts);
    const workingDays = calculateWorkingDays(checkInsAndOuts);

    return {
      data:data,
      workingHours:workingHours,
      workingDays:workingDays
    }

  },

 async getAttendanceByDay(ctx,day) {
   const user = ctx.state.user;


    return day
  }
}));
