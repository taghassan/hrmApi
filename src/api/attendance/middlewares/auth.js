

module.exports = (config, { strapi })=> {
  return (ctx, next) => {

    if(ctx.request.headers && ctx.request.headers.authorization){
      if(ctx.request.headers.authorization.split(' ') && ctx.request.headers.authorization.split(' ').reverse() && ctx.request.headers.authorization.split(' ').reverse()[0]){

        const token =ctx.request.headers.authorization.split(' ').reverse()[0]
        const user =ctx.state.user
        if(token && user.authorization && token===user.authorization){
          return next();
        }else {

          return ctx.unauthorized("This action is unauthorized.");
        }

      }else{

        return ctx.unauthorized("This action is unauthorized.");
      }

    }else{
      return ctx.unauthorized("This action is unauthorized.");
    }
  ;
  };
};

