// backend/Validation/index.js
const { yup } = require("@strapi/utils"); //Importing yup
const { object, string, number } = yup; //Destructuring object and string from yup


const UserSchema = object().shape({
  // Creating userSchema
  identifier: string().min(3).required(), // username validation
  password: string() // password validation
    .min(6) // password should be minimum 6 characters
    .required("Please Enter your password") // password is required
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{6,})/,
      "Must Contain 6 Characters, One Uppercase, One Lowercase, One Number and One Special Case Character"
    ), // Regex for strong password
});

const BlogCreateSchema = object().shape({
  // Creating BlogCreateSchema
  title: string().min(3).required(), // title validation
  post: string().min(6).required(), // post validation
});
const BlogUpdateSchema = object().shape({
  // Creating BlogUpdateSchema
  title: string().min(3).optional(), // title validation
  post: string().min(6).optional(), // post validation
});
module.exports = {
  // Exporting UserSchema
  UserSchema,
  // Exporting BlogCreateSchema
  BlogCreateSchema,
  // Exporting BlogUpdateSchema
  BlogUpdateSchema,
};