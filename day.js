const dayjs = require("dayjs");

const formatDate = (str, format) => {
  return dayjs(str).format(format);
};

/**
 * day.js版本格式化日期时间
 * @param str
 * @param format      YYYY-MM-DD HH:mm:ss
 * @returns {string}
 */
module.exports = {
  formatDate,
};
