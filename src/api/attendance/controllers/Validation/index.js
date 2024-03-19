const { yup, validateYupSchema} = require("@strapi/utils"); //Importing yup
const { object, string,date } = yup; //Destructuring object and string from yup

 const CheckOutSchema = yup.object({

  current_lat: string().required(),
  current_lang: string().required(),
   // actionDate:string().required(),
   // time:string().required()
});

module.exports = {
  // Exporting CheckOutSchema
  validateCheckINOutBody: validateYupSchema(CheckOutSchema),
};
