// import ms from "ms";

// export const setAuthCookies = (res, accessToken, refreshToken) => {
//   const isProduction = process.env.NODE_ENV === "production";

//   const accessMaxAge = ms(process.env.JWT_ACCESS_EXPIRES || "15m");
//   const refreshMaxAge = ms(process.env.JWT_REFRESH_EXPIRES || "7d");

//   res.cookie("AccessToken", accessToken, {
//     httpOnly: true,
//     secure: isProduction,
//     sameSite: isProduction ? "none" : "lax",
//     maxAge: accessMaxAge,
//   });

//   res.cookie("RefreshToken", refreshToken, {
//     httpOnly: true,
//     secure: isProduction,
//     sameSite: isProduction ? "none" : "lax",
//     maxAge: refreshMaxAge,
//   });
// };

//  // Clear  Cookies
// export const clearAuthCookies = (res) => {
//   const isProduction = process.env.NODE_ENV === "production";

//   const options = {
//     httpOnly: true,
//     secure: isProduction,
//     sameSite: isProduction ? "none" : "lax",
//   };

//   res.clearCookie("AccessToken", options);
//   res.clearCookie("RefreshToken", options);
// };




// use when frontend & backend deploy in different domain

import ms from "ms";

export const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === "production";

  const accessMaxAge = ms(process.env.JWT_ACCESS_EXPIRES || "15m");
  const refreshMaxAge = ms(process.env.JWT_REFRESH_EXPIRES || "7d");

  res.cookie("AccessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: accessMaxAge,
  });

  res.cookie("RefreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });
};

export const clearAuthCookies = (res) => {
  const isProduction = process.env.NODE_ENV === "production";

  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };

  res.clearCookie("AccessToken", options);
  res.clearCookie("RefreshToken", options);
};
