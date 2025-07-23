export const useLog = (req, res, next) => { 
  //Get route
  const route = req.originalUrl;
  //Get method
  const method = req.method;
  //Get user agent
  const userAgent = req.headers['user-agent'];
  console.log("Server: Route => ", route+" | Method => ", method+" | User Agent => ", userAgent);
  next();
}