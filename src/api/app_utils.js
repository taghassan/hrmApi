 const  mapUserWithSift =(userWithSift)=> {
  if (userWithSift && userWithSift.shift && userWithSift.shift.days) {


    const daysMap = []
    userWithSift.shift.days.map(day => {
      const dayCast = {
        id: day.id,
        isWorkingDay: day.isWorkingDay,
        isWeekEnd: day.isWeekEnd,
        start_at: day.start_at,
        end_at: day.end_at,
        day: day.day ? day.day.day : '',
        dayId: day.day ? day.day.id : '',

      }
      if (day.day)
        daysMap.push(dayCast)
    })
    userWithSift.shift.days = daysMap


  }
  return userWithSift
}

const mapShiftDays =(shift)=>{

  if (shift && shift.days) {
    const daysMap = []
    shift.days.map(day => {
      const dayCast = {
        id: day.id,
        isWorkingDay: day.isWorkingDay,
        isWeekEnd: day.isWeekEnd,
        start_at: day.start_at,
        end_at: day.end_at,
        day: day.day ? day.day.day : '',
        dayId: day.day ? day.day.id : '',

      }
      if (day.day)
        daysMap.push(dayCast)
    })
    shift.days = daysMap
  }
  return shift
}

 module.exports = {
  mapUserWithSift,
   mapShiftDays
}
