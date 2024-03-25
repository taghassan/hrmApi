'use strict';

const url = require('url');
const {validateCheckINOutBody} = require("./Validation");
const utils = require("@strapi/utils");
const {mapUserWithSift, mapShiftDays} = require("../../app_utils");

const {ApplicationError,} = utils.errors;
const {eachDayOfInterval, startOfMonth, endOfMonth, format} = require('date-fns');

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
    return ctx.send(
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
    const {from, to} = ctx.request.query

    const user = ctx.state.user;

    const userWithShift = await getUserShift(user)
    const mapUserWithShift = mapUserWithSift(userWithShift)


    /**********************************************************/
    /**   **/
    /**********************************************************/
    const now = new Date();
    const firstDayOfMonth = from ?? startOfMonth(now);
    const lastDayOfMonth = to ?? endOfMonth(now);


    const allDaysInMonth = eachDayOfInterval({start: firstDayOfMonth, end: lastDayOfMonth});


    let dayOfTheWeek = []
    for (const day of allDaysInMonth) {

      if (mapUserWithShift.shift && userWithShift.shift.days) {

        const dayOfWork = userWithShift.shift.days.filter(shiftDay => shiftDay.day.toLowerCase() === day.toLocaleString('en-us', {weekday: 'long'}).toLowerCase())
        let attended = null
        if (dayOfWork[0] && dayOfWork[0].isWorkingDay) {

          attended = await strapi
            .query("api::attendance.attendance").findOne({
              where: {
                $and: [
                  {
                    user: user.id
                  },
                  {
                    date: `${format(day, 'yyyy-MM-dd')}`
                  },
                  {
                    type: 'checkIn'
                  }
                ]
              }
            })

        }


        dayOfTheWeek.push({
          day: format(day, 'yyyy-MM-dd'),
          now: format(now, 'yyyy-MM-dd'),
          name: day.toLocaleString('en-us', {weekday: 'long'}),
          isWorkingDay: dayOfWork[0] ? dayOfWork[0].isWorkingDay : null,
          isPast: format(day, 'yyyy-MM-dd') <= format(now, 'yyyy-MM-dd'),
          dayOfWork: dayOfWork ? dayOfWork[0] : null,
          attended: attended ?? null
        })

      }


    }

    const calculateRateOfCommitment = (attendedDays, absentDays, totalDays) => {
      if (totalDays === 0) {
        return 0; // To avoid division by zero
      }

      const attendedRatio = attendedDays / totalDays;
      const commitmentRate = attendedRatio * 100;

      return commitmentRate.toFixed(2); // Return commitment rate rounded to 2 decimal places
    }

    let totalDays = 0
    let attendedDays = 0
    let offDays = 0
    let absentDays = 0
    let vacation_balance = 0
    let early_leave = 0
    let permissions = 0
    let rateOfCommitment = 0.0

    for (const data of dayOfTheWeek) {
      if (data.isPast === true) {
        totalDays++

        if (data.isWorkingDay === true && data.attended != null) {
          attendedDays++
        }
        if (data.isWorkingDay === true && data.attended === null) {
          absentDays++
        }
        if (data.isWorkingDay === false) {
          offDays++
        }
      }
    }

    rateOfCommitment = calculateRateOfCommitment(attendedDays, absentDays, totalDays - offDays)


    return {
      totalDays,
      attendedDays,
      offDays,
      absentDays,
      rateOfCommitment,
      vacation_balance,
      early_leave,
      permissions,
      from: format(firstDayOfMonth, 'yyyy-MM-dd'),
      to: format(lastDayOfMonth, 'yyyy-MM-dd')
    }
  },

  async getAttendanceByDay(ctx, day) {
    const user = ctx.state.user;


    return day
  }
}));


