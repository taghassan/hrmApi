'use strict';

const url = require('url');
const {validateCheckINOutBody} = require("./Validation");
const utils = require("@strapi/utils");
const {mapUserWithSift, mapShiftDays} = require("../../app_utils");

const {ApplicationError,} = utils.errors;
const {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  format,
  parse,
  differenceInMilliseconds,
  formatDuration
} = require('date-fns');

/**
 * attendance controller
 */

const {createCoreController} = require('@strapi/strapi').factories;

const checkOut_KEY = 'checkOut'
const checkIn_KEY = 'checkIn'

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

//TODO User this to format
function toformatDate(date,format){
 return format(new Date(`${date}`),`${format}`)
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

const applySortByTime = (a, b) => {
  const timeA = a.time.split(':').map(Number); // Convert time string to array of numbers
  const timeB = b.time.split(':').map(Number);

  // Compare hours
  if (timeA[0] < timeB[0]) {
    return -1;
  }
  if (timeA[0] > timeB[0]) {
    return 1;
  }

  // If hours are equal, compare minutes
  if (timeA[1] < timeB[1]) {
    return -1;
  }
  if (timeA[1] > timeB[1]) {
    return 1;
  }

  // If minutes are equal, compare seconds
  if (timeA[2] < timeB[2]) {
    return -1;
  }
  if (timeA[2] > timeB[2]) {
    return 1;
  }

  return 0; // Times are equal
}

module.exports = createCoreController('api::attendance.attendance', ({strapi}) => ({

  async checkOut(ctx) {
    const {current_lat, current_lang, actionDate, time} = await validateCheckINOutBody(ctx.request.body)
    const user = ctx.state.user;
    const userWithBranch = await getUserBranch(user)
    const currentTime = new Date();


    /**********************************************************/
    /**   **/
    /**********************************************************/
    const userWithShift = await getUserShift(user)
    const mapUserWithShift = mapUserWithSift(userWithShift)

    const dayOfWork = userWithShift && userWithShift.shift && userWithShift.shift.days ? userWithShift.shift.days.filter(shiftDay => shiftDay.day.toLowerCase() === (actionDate ?? currentTime).toLocaleString('en-us', {weekday: 'long'}).toLowerCase()) : null

    const entry = await strapi
      .service("api::attendance.attendance")
      .create(
        {
          "data": {
            "type": "checkOut",
            "date": actionDate ?? currentTime,
            "time": time ?? currentTime,
            "user": user.id,
            "branch": userWithBranch && userWithBranch.branch ? userWithBranch.branch.id : null,
            "latitude": current_lat ?? '0.0',
            "longitude": current_lang ?? '0.0',
            "dayOfWork": dayOfWork && dayOfWork[0] && dayOfWork[0].day ? dayOfWork[0].day : '',
            "dayOfWorkStartAt": dayOfWork && dayOfWork[0] && dayOfWork[0].start_at ? dayOfWork[0].start_at : '',
            "dayOfWorkEndAt": dayOfWork && dayOfWork[0] && dayOfWork[0].end_at ? dayOfWork[0].end_at : '',
            "dayOfWorkIsWorkingDay": dayOfWork && dayOfWork[0] && dayOfWork[0].isWorkingDay ? dayOfWork[0].isWorkingDay : true,
            "dayOfWorkIsWeekEnd": dayOfWork && dayOfWork[0] && dayOfWork[0].isWeekEnd ? dayOfWork[0].isWeekEnd : false,
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

    /**********************************************************/
    /**   **/
    /**********************************************************/
    const userWithShift = await getUserShift(user)
    const mapUserWithShift = mapUserWithSift(userWithShift)

    const dayOfWork = userWithShift && userWithShift.shift && userWithShift.shift.days ? userWithShift.shift.days.filter(shiftDay => shiftDay.day.toLowerCase() === (actionDate ?? currentTime).toLocaleString('en-us', {weekday: 'long'}).toLowerCase()) : null

    await strapi
      .service("api::attendance.attendance")
      .create(
        {
          "data": {
            "type": "checkIn",
            "date": actionDate ?? currentTime,
            "time": time ?? currentTime,
            "user": user.id,
            "branch": userWithBranch && userWithBranch.branch ? userWithBranch.branch.id : null,
            "latitude": current_lat ?? '0.0',
            "longitude": current_lang ?? '0.0',
            "dayOfWork": dayOfWork && dayOfWork[0] && dayOfWork[0].day ? dayOfWork[0].day : '',
            "dayOfWorkStartAt": dayOfWork && dayOfWork[0] && dayOfWork[0].start_at ? dayOfWork[0].start_at : '',
            "dayOfWorkEndAt": dayOfWork && dayOfWork[0] && dayOfWork[0].end_at ? dayOfWork[0].end_at : '',
            "dayOfWorkIsWorkingDay": dayOfWork && dayOfWork[0] && dayOfWork[0].isWorkingDay ? dayOfWork[0].isWorkingDay : true,
            "dayOfWorkIsWeekEnd": dayOfWork && dayOfWork[0] && dayOfWork[0].isWeekEnd ? dayOfWork[0].isWeekEnd : false,
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

    try {
      const {from, to} = ctx.request.query

      /**********************************************************/
      /**   **/
      /**********************************************************/
      const now = new Date();
      let firstDayOfMonth = from ?? startOfMonth(now);
      let lastDayOfMonth = to ?? endOfMonth(now);

      firstDayOfMonth= new Date(`${firstDayOfMonth}`)
      lastDayOfMonth= new Date(`${lastDayOfMonth}`)

      const allDaysInMonth = eachDayOfInterval({
        start: firstDayOfMonth,
        end: lastDayOfMonth
      });

      const user = ctx.state.user;
      const userWithShift = await getUserShift(user)
      const mapUserWithShift = mapUserWithSift(userWithShift)
      const sanitizedQueryParams = await this.sanitizeQuery(ctx);

      sanitizedQueryParams.filters = {
        $and: [
          {
            user: user.id
          },
          {
            date: {
              $gte: `${format(firstDayOfMonth, 'yyyy-MM-dd')}`,
              $lte: `${format(lastDayOfMonth, 'yyyy-MM-dd')}`,
              $notNull: true,
            },
          }

        ]
      }
      sanitizedQueryParams.populate = '*'
      sanitizedQueryParams.sort = {id: 'desc'}
      sanitizedQueryParams.pagination = {pageSize: 200}

      const {results, pagination} = await strapi
        .service("api::attendance.attendance").find(sanitizedQueryParams)

      const outputArr = [];
      const outputTest = [];

      for (const day of allDaysInMonth.reverse()) {

        let status = 'absent'

        /**********************************************************/
        /** check is past  **/
        /**********************************************************/
        let lateInMinutes = 0
        if (format(day, 'yyyy-MM-dd') <= format(now, 'yyyy-MM-dd')) {

          const {todayCheckInAttendance, todayCheckOutAttendance} = this.getToActionsOnDay(results, day)

          let checkIn = todayCheckInAttendance.sort(applySortByTime)[0]
          let checkOut = todayCheckOutAttendance.sort(applySortByTime)[todayCheckOutAttendance.length - 1]

          let dayOfWork = null

          dayOfWork = userWithShift && userWithShift.shift ? userWithShift.shift.days.filter(shiftDay => shiftDay.day.toLowerCase() === day.toLocaleString('en-us', {weekday: 'long'}).toLowerCase()) : null

          // return userWithShift.shift.days

          if (checkIn) {

            status = 'attendOnTime'

            if (dayOfWork && dayOfWork[0] && dayOfWork[0].start_at && checkIn && checkIn.time && checkIn.date) {

              /**********************************************************/
              /**   **/
              /**********************************************************/
              try {
                const {differenceInMinutes} = this.getDiff(checkIn.date, checkIn.time, day, dayOfWork[0].start_at)

                outputTest.push(differenceInMinutes)

                if (differenceInMinutes > 20) {
                  status = 'attendOnLate'
                }

                lateInMinutes = differenceInMinutes

              } catch (e) {
                lateInMinutes = -99
              }

            } else {

            }

            checkIn = checkIn.type === checkIn_KEY ? checkIn.time : null
          } else {

            if (dayOfWork && dayOfWork[0] && dayOfWork[0].isWorkingDay) {

              status = 'absent'
            } else if (dayOfWork && dayOfWork[0] && dayOfWork[0].isWeekEnd) {

              status = 'WeekEnd'
            } else {

              status = 'notWorkingDay'
            }
          }

          if (checkOut) {
            checkOut = checkOut.type === checkOut_KEY ? checkOut.time : null
          }

          outputArr.push({
            date: format(day, 'yyyy-MM-dd'),
            isLate: lateInMinutes > 20,

            // dayOfWork: dayOfWork ? dayOfWork[0] ?? null : null,
            // dayOfWork: dayOfWork ? dayOfWork[0] ?? null : null,
            outputTest:outputTest,
            lateInMinutes: lateInMinutes,
            dayOfWork: dayOfWork ? dayOfWork[0].day ?? null : null,
            dayOfWorkStartAt: dayOfWork ? dayOfWork[0].start_at ?? null : null,
            dayOfWorkEndAt: dayOfWork ? dayOfWork[0].start_at ?? null : null,
            dayOfWorkIsWorkingDay: dayOfWork ? dayOfWork[0].isWorkingDay ?? null : null,
            dayOfWorkIsWeekEnd: dayOfWork ? dayOfWork[0].isWeekEnd ?? null : null,

            checkIn: checkIn ?? null,
            checkOut: checkOut ?? null,
            status: status ?? ''
          })
        }
      }

      return ctx.send(
        {
          ok: true,
          entries: outputArr,
          pagination: pagination,
          message: 'executed successfully !'
        }
      )

    } catch (e) {
      throw new ApplicationError(`${e}`);
    }

  },

  async recentActions(ctx) {

    // const user = ctx.state.user;
    //
    // const lastCheckin = await this.getLastAction('checkIn', user);
    // const lastCheckOut = await this.getLastAction('checkOut', user);
    //
    //
    // const lastCheckinDatetime = lastCheckin[0] ? '' + lastCheckin[0].date + ' ' + lastCheckin[0].time : ''
    // const lastCheckOutDatetime = lastCheckOut[0] ? '' + lastCheckOut[0].date + ' ' + lastCheckOut[0].time : ''
    //
    //
    // ctx.send(
    //   {
    //     ok: true,
    //     // lastCheckin: lastCheckin[0] ?? null,
    //     // lastCheckOut: lastCheckOut[0] ?? null,
    //     last_checkin_datetime: lastCheckinDatetime,
    //     last_checkout_datetime: lastCheckOutDatetime,
    //     message: 'executed successfully !'
    //   }
    // )

    const user = ctx.state.user;
    const sanitizedQueryParams = await this.sanitizeQuery(ctx);


    sanitizedQueryParams.filters = {
      $and: [
        {
          user: user.id
        }
      ]
    }
    sanitizedQueryParams.sort = {date: 'desc'}
    sanitizedQueryParams.populate = '*'

    const {results, pagination} = await strapi
      .service("api::attendance.attendance").find(sanitizedQueryParams)

    const outputArr = [];
    for (const entry of results) {

      outputArr.push(
        {
          date: entry.date,
          type: entry.type,
          branch: entry.branch ? entry.branch.name : '',
          branchId: entry.branch ? entry.branch.id : null,
          check_in_time: entry.type === checkIn_KEY ? entry.time : null,
          check_out_time: entry.type === checkOut_KEY ? entry.time : null
        }
      )
    }


    return ctx.send(
      {
        ok: true,
        entries: outputArr,
        pagination: pagination,
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


    let first_check_in = await this.getLastAction('checkIn', user, 'asc', new Date());
    let last_check_out = await this.getLastAction('checkOut', user, 'desc', new Date());
    if (!first_check_in[0]) {
      first_check_in = await this.getLastAction('checkIn', user, 'asc');

      last_check_out = await this.getLastAction('checkOut', user, 'desc');
    }

    ctx.send({
      name: user.NameAr,
      NameEn: user.NameEn,
      NameAr: user.NameAr,
      email: user.email,
      branch_id: branch ? branch.id ?? 0 : null,

      image: userWithBranch.Photo ? `https://strapi.syscodeia.ae${userWithBranch.Photo.url}` : '',
      photo: userWithBranch.Photo ? `https://strapi.syscodeia.ae${userWithBranch.Photo.url}` : '',
      first_check_in: first_check_in[0] ? '' + first_check_in[0].date + ' ' + first_check_in[0].time : null,
      last_check_out: last_check_out[0] ? '' + last_check_out[0].date + ' ' + last_check_out[0].time : null,
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
          attended: attended ?? null,
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
    let late_attendance = 0

    // return dayOfTheWeek
    for (const data of dayOfTheWeek) {
      if (data.isPast === true) {
        totalDays++

        if (data.isWorkingDay === true && data.attended != null) {
          attendedDays++

          if (data.dayOfWork) {

            const endTime = parse(`${data.attended.date} ${data.attended.time}`, 'yyyy-MM-dd HH:mm:ss.SSS', new Date());
            const startTime = parse(`${data.attended.date} ${data.dayOfWork.start_at}`, 'yyyy-MM-dd HH:mm:ss.SSS', new Date());

            // Calculate difference in milliseconds
            let difference = differenceInMilliseconds(endTime, startTime);


            // Handle cases where endTime is earlier than startTime (i.e., it's on the next day)
            if (difference < 0) {
              difference += 24 * 60 * 60 * 1000; // Add 24 hours in milliseconds
            }

            let differenceInSeconds = Math.floor(difference / 1000);
            let differenceInMinutes = Math.floor(differenceInSeconds / 60);
            let hrs = Math.floor(differenceInSeconds / 3600);

            // console.log(`****************************************************`);
            // console.log(`difference ${startTime} - ${endTime} = ${difference}  =============  ${differenceInSeconds} ++===++ ${differenceInMinutes} =----------= ${hrs}`);
            // console.log(`****************************************************`);
            if (differenceInMinutes > 20) {
              ++late_attendance
            }
          }

        }
        if (data.isWorkingDay === true && data.attended === null) {
          ++absentDays
        }
        if (data.isWorkingDay === false) {
          ++offDays
        }
      }
    }

    rateOfCommitment = calculateRateOfCommitment(attendedDays, absentDays, totalDays - offDays)

    // const lastCheckin =await this.getLastAction('checkIn',user);
    // const lastCheckOut = await this.getLastAction('checkOut',user);
    // const lastCheckinDatetime = lastCheckin[0] ? '' + lastCheckin[0].date + ' ' + lastCheckin[0].time : ''
    // const lastCheckOutDatetime = lastCheckOut[0] ? '' + lastCheckOut[0].date + ' ' + lastCheckOut[0].time : ''
    //      last_checkin_datetime: lastCheckinDatetime,
    //       last_checkout_datetime: lastCheckOutDatetime,

    return {
      totalDays,
      attendedDays,
      offDays,
      absentDays,
      rateOfCommitment,
      vacation_balance,
      early_leave,
      permissions,
      late_attendance,

      nationalIDExpiryDate: user.nationalIDExpiryDate,
      passportExpiryDate: user.passportExpiryDate,
      residenceExpiryDate: user.residenceExpiryDate,
      from: format(firstDayOfMonth, 'yyyy-MM-dd'),
      to: format(lastDayOfMonth, 'yyyy-MM-dd')
    }
  },

  async getAttendanceByDay(ctx, day) {
    const user = ctx.state.user;


    return day
  },
  async getLastAction(actionType, user, sort = 'desc', day) {

    let filter = {
      filters: {
        $and: [
          {
            user: user.id
          },
          {
            type: `${actionType}`
          },

        ]
      },
      sort: {id: sort},
      limit: 1,
      populate: '*',
    }

    if (day) {
      filter.filters.$and.push({

        date: `${format(day, 'yyyy-MM-dd')}`

      })
    }


    return await strapi.entityService.findMany("api::attendance.attendance", filter)
  },
  getDiff(date1, time1, date2, time2) {

    try {
      
      date1=new Date(`${date1}`)
      date2=new Date(`${date2}`)

      const endTime = parse(`${format(date1, 'yyyy-MM-dd')} ${time1}`, 'yyyy-MM-dd HH:mm:ss.SSS', new Date());
      const startTime = parse(`${format(date2, 'yyyy-MM-dd')} ${time2}`, 'yyyy-MM-dd HH:mm:ss.SSS', new Date());

      //
      let difference = differenceInMilliseconds(endTime, startTime);
      // let difference =0
      // Handle cases where endTime is earlier than startTime (i.e., it's on the next day)
      if (difference < 0) {
        difference += 24 * 60 * 60 * 1000; // Add 24 hours in milliseconds
      }

      if (startTime > endTime) {
        difference = difference * -1
      }

      let differenceInSeconds = Math.floor(difference / 1000);
      let differenceInMinutes = Math.floor(differenceInSeconds / 60);
      let hrs = Math.floor(differenceInSeconds / 3600);
      return {
        differenceInSeconds,
        differenceInMinutes,
        differenceInhrs: hrs,
      }
    } catch (e) {
      return {
        differenceInSeconds: -1,
        differenceInMinutes: -1,
        differenceInhrs: -1,
      }
    }

  },
  getToActionsOnDay(results, day) {

    try {
      const date = new Date(`${day}`);
      const todayCheckInAttendance = (results ?? []).filter(attendance => (attendance.date && format(new Date(`${attendance.date}`), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) && attendance.type === `${checkIn_KEY}`)
      const todayCheckOutAttendance = (results ?? []).filter(attendance => (attendance.date && format(new Date(`${attendance.date}`), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) && attendance.type === `${checkOut_KEY}`)

      return {
        todayCheckInAttendance:todayCheckInAttendance,
        todayCheckOutAttendance:todayCheckOutAttendance
      }
    } catch (e) {
      return {
        todayCheckInAttendance: [],
        todayCheckOutAttendance: []
      }
    }

  }
}));

