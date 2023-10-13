const jwt = require('jsonwebtoken');

const fetchuser = (req, res, next) => {
  const token = req.header('token');
  if (!token) {
    return res.json({
      success: false,
      error: "You are not authorized, Please login to get access"
    });
  };
  try {
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
      if (err) {
        return res.json({
          success: false,
          error: err
        });
      };
      req.username = decoded.loggedinUser;
      next();
    });
  } catch (err) {
    res.json({ 
      success: false, 
      error: err });
  };
};

module.exports = fetchuser;