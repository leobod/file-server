const Koa = require("koa");
const { koaBody } = require("koa-body");
const fs = require("fs-extra");
const path = require("path");
const mime = require("mime");
const { formatDate } = require("./day");

const fileServerBaseDir = `F:\\wsl\\`;
const fileServerBucket = {
  "2e21d1914fa4": "./bucket_a",
  "821206f82352": "./bucket_b",
};
const app = new Koa();
// 确保上传目录存在
// 确保上传目录存在
// const createUploadsFolder = (dir) => {
//   if (!fs.existsSync(dir)) {
//     fs.mkdirSync(dir, { recursive: true });
//   }
// };
// const uploadsDir = path.join(__dirname, "uploads");
// createUploadsFolder(uploadsDir);

// 配置koa-body以处理文件上传
const bodyConfig = {
  multipart: true, // 启用multipart表单数据解析
  formidable: {
    keepExtensions: true, // 保留文件扩展名
    maxFieldsSize: 2 * 1024 * 1024, // 最大字段大小
    maxFileSize: 500 * 1024 * 1024, // 单个文件最大大小
  },
};
app.use(koaBody(bodyConfig));

const getDirFileListView = function (relPath) {
  const fileInfoList = getDirFileList(relPath);
  fileInfoList.unshift({
    name: "..",
    size: 0,
    createdAt: null,
    modifiedAt: null,
    isDirectory: true,
    isFile: false,
    type: null,
  });
  const html = [];
  html.push(`<style>`);
  html.push(`table tr th { background-color: #e6e6e6; }`);
  html.push(`table tr th { padding: 10px; }`);
  html.push(`table tr td { padding: 10px; }`);
  html.push(`</style>`);
  html.push(
    `<table border="0" cellspacing="0" cellpadding="0" style="width: 100%">`
  );
  html.push(`<colgroup>`);
  html.push(`<col width="600" />`);
  html.push(`<col width="180" />`);
  html.push(`<col width="180" />`);
  html.push(`</colgroup>`);

  html.push(`<tr>`);
  html.push(`<th align="left">名称</th>`);
  html.push(`<th align="center">修改时间</th>`);
  html.push(`<th align="center">创建时间</th>`);
  html.push(`</tr>`);

  for (const item of fileInfoList) {
    html.push(`<tr>`);
    html.push(
      `<td align="left"><a href="./${item.name}">${item.name}</a></td>`
    );
    html.push(
      `<td align="center">${
        item.modifiedAt
          ? formatDate(item.modifiedAt, "YYYY/MM/DD HH:mm:ss")
          : ""
      }</td>`
    );
    html.push(
      `<td align="center">${
        item.createdAt ? formatDate(item.createdAt, "YYYY/MM/DD HH:mm:ss") : ""
      }</td>`
    );
    html.push(`</tr>`);
  }
  html.push(`</table>`);
  return html.join("");
};

const getDirFileList = function (relPath) {
  const fileList = fs.readdirSync(relPath);
  const fileInfoList = [];
  fileList.forEach((item) => {
    const itemPath = path.join(relPath, item);
    try {
      const stat = fs.statSync(itemPath);
      fileInfoList.push({
        name: item,
        size: stat.size,
        createdAt: stat.ctime,
        modifiedAt: stat.mtime,
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        type: mime.getType(item),
      });
    } catch (e) {
      fileInfoList.push({
        name: item,
        size: null,
        createdAt: null,
        modifiedAt: null,
        isDirectory: null,
        isFile: null,
        type: null,
      });
    }
  });
  return fileInfoList;
};

const upload = async (ctx) => {
  try {
    const file = ctx.request.files.file; // 假设表单中文件字段名为file
    if (!file) {
      ctx.throw(400, "No file uploaded");
    }

    // 这里可以根据需要处理文件，例如重命名、移动到其他位置等
    // 以下代码仅为示例，展示如何获取文件信息
    ctx.body = {
      filename: file.name,
      filepath: file.path,
      size: file.size,
    };
  } catch (error) {
    ctx.status = error.status || 500;
    ctx.body = { error: error.message };
  }
};

app.use(async (ctx, next) => {
  const fullUrl = `http://${ctx.request.header.host}${ctx.url}`;
  const fullLocation = new URL(fullUrl);
  const { pathname = "", searchParams = {} } = fullLocation;
  let accessKey = null;
  let isDir = false;
  const pathnameList = pathname.split("/");
  if (pathnameList && pathnameList.length > 0) {
    accessKey = pathnameList[1];
    if (pathname[pathname.length - 1] === "/") {
      isDir = true;
    }
  }

  const action = searchParams.get("action") || "VIEW";
  const bucketDir = fileServerBucket[accessKey];
  if (accessKey && bucketDir) {
    let relPath = path.join(fileServerBaseDir, bucketDir);
    if (ctx.method === "GET") {
      if (action === "VIEW" || action === "FILE") {
        if (isDir) {
          ctx.body = getDirFileListView(relPath);
        } else {
          relPath = path.join(relPath, pathname.replace(`/${accessKey}`, "."));
          const fileName = pathnameList[pathnameList.length - 1];
          const fileStat = fs.statSync(relPath);
          if (fileStat.isFile()) {
            // ctx.type = mime.getType(relPath);
            // Content-Disposition: `attachment; filename="${fileName}"`
            ctx.set("Content-Length", fileStat.size);
            ctx.set("Content-Type", mime.getType(relPath));
            if (action === "FILE") {
              ctx.set(
                "Content-Disposition",
                `attachment; filename="${fileName}"`
              );
            }
            ctx.body = fs.createReadStream(relPath);
          }
        }
      }
    } else if (ctx.method === "POST") {
      if (action === "UPLOAD") {
        if (isDir) {
          ctx.body = "please input the correct filename";
        } else {
          relPath = path.join(relPath, pathname.replace(`/${accessKey}`, "."));
          const fileName = pathnameList[pathnameList.length - 1];
          const fileData =
            (ctx.request.files && ctx.request.files.file) || null;
          const file = Object.assign({}, fileData);
          if (file) {
            const reader = fs.createReadStream(file.filepath);
            const fileNameArr = file.originalFilename.split(".");
            let ext = "";
            if (fileNameArr.length > 0) {
              ext = fileNameArr.pop();
            }
            let filePath = relPath;
            const upStream = fs.createWriteStream(filePath);
            reader.pipe(upStream);
            ctx.body = "success";
          }
        }
      }
    }
  } else {
    ctx.body = "unavailable";
  }
});

// "application/octet-stream" : "text/plain"
// ctx.attachment(filename);

const PORT = process.env.PORT || 8361;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
