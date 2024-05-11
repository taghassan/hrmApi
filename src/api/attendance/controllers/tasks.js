const {UnifiedResponse} = require("../../app_utils");
module.exports={
  async getTasks(ctx){

    const data={
      new_tasks: 3,
      current_tasks: 7,
      pending_tasks: 2,
      done_tasks: 15,
      late_tasks: 1,
      today_tasks: 5,
      later_tasks: 10,
      projects: [
        {
          name: 'Project A',
          id: 'projA123'
        },
        {
          name: 'Project B',
          id: 'projB456'
        }
      ]
    }

    return new UnifiedResponse(
      true,
      data,
      'executed successfully !'
    )


  }
}
