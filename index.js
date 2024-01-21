#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const inquirer = require('inquirer');
const path = require('path');
const util = require('util');
// 异步读取写入文件
const readAsync = util.promisify(fs.readFile);
const writeAsync = util.promisify(fs.writeFile);
const renameAsync = util.promisify(fs.rename);

/**
 * 读取某个路径下所有文件夹或者文件
 * @param {*isFile:文件，isDirectory文件夹} type
 * @param {*读取绝对路径} src
 */
const readALlDir = (type, pathName) => {
  return new Promise((resolve, reject) => {
    fs.readdir(pathName, function (err, files) {
      var dirs = [];
      (function iterator(i) {
        if (i == files.length) {
          resolve(dirs);
          return;
        }
        fs.stat(path.join(pathName, files[i]), function (err, data) {
          if (type === 'isDirectory' ? data.isDirectory() : data.isFile()) {
            dirs.push(files[i]);
          }
          iterator(i + 1);
        });
      })(0);
    });
  });
};

inquirer
  .prompt([
    {
      type: 'input',
      name: 'noJoin',
      message: '请填写不参与生成目录的文件或文件夹名称，多个用英文逗号隔开，例如： dist,mock',
    },
    {
      type: 'input',
      name: 'name',
      message: '请填写参与生成目录后缀，多个用英文逗号隔开，例如：tsx,vue,ts',
    }
  ])
  .then(async (answers) => {
    // 不参与列表
    let noJoinList = [...answers.noJoin.split(','), 'node_modules']
    // let noJoinList = [
    //   'mock',
    //   'dist',
    //   'node_modules',
    //   'assets',
    //   'utils',
    //   'service',
    //   'models',
    // ];
    // 参与后缀列表
    let nameList = answers.name.split(',')
    // let nameList = ['tsx', 'ts'];
    let arrPromise = [];
    // 获取所有文件夹和文件信息
    const getInfo = async (treeObj, parentLeval, parentPath) => {
      let onePromise = new Promise(async (resolve, reject) => {
        // 当前目录文件夹
        let directoryList = await readALlDir(
          'isDirectory',
          path.join(process.cwd(), parentPath),
        );
        // 当前目录文件
        let fileList = await readALlDir(
          'isFile',
          path.join(process.cwd(), parentPath),
        );
        directoryList = directoryList.filter((item) => {
          // 筛选出参与列表以及开头不为特殊符号的文件夹
          return noJoinList.indexOf(item) < 0 && /^[A-Za-z]+$/.test(item[0]);
        });
        fileList = fileList.filter((item) => {
          let fileNameList = item.split('.');
          let fileName = fileNameList[fileNameList.length - 2];
          let fileEnd = fileNameList[fileNameList.length - 1];
          // 筛选有文件名的，指定后缀名的，没有特殊字符的文件, 以及名称不包含不参与目录的文件
          return (
            fileName.length &&
            nameList.indexOf(fileEnd) > -1 &&
            /^[A-Za-z]+$/.test(fileName) &&
            noJoinList.indexOf(fileName) < 0
          );
        });
        treeObj.leval = parentLeval + 1;
        treeObj.parentPath = parentPath;
        fileList.forEach(async (item) => {
          // 逐行读取当前文件的内容
          const stream = fs.createReadStream(
            path.join(process.cwd(), parentPath + '/' + item),
          );
          const rl = readline.createInterface({
            input: stream,
          });
          let remakeInfo = '';
          await new Promise((resolve, reject) => {
            let lineNum = 0;
            // 开始读取
            rl.on('line', (line) => {
              lineNum++;
              // 如果第一行不是备注开头的，直接返回
              if (lineNum === 1 && line.indexOf('/**') < 0) {
                rl.close();
                remakeInfo = '没有找到备注(⊙︿⊙)';
                resolve();
              }
              // 找到@name,返回
              if (line.indexOf('@name') > -1) {
                remakeInfo = line.split('@name')[1];
                rl.close();
                resolve();
              }
            }).on('close', () => {
              resolve();
            });
          });
          treeObj.fileChild.push({
            name: item,
            info: remakeInfo,
          });
        });
        directoryList.forEach((item) => {
          let obj = {
            // 文件夹列表
            directoryChild: [],
            // 文件列表
            fileChild: [],
            path: `${item}`,
            parentPath: '',
            leval: parentLeval + 1,
          };
          treeObj.directoryChild.push(obj);
        });
        treeObj.directoryChild.forEach((item) => {
          getInfo(item, parentLeval + 1, parentPath + '/' + item.path);
        });
        resolve();
        // console.log(directoryList, 'directoryList')
        // console.log(parentPath, fileList, 'fileList')
      });
      arrPromise.push(onePromise);
    };
    let treeObj = {
      // 文件夹列表
      directoryChild: [],
      // 文件列表
      fileChild: [],
      path: '',
      parentPath: '',
      leval: 0,
    };
    getInfo(treeObj, -1, '');
    // 设置循环，判断promise是否添加完成
    let arrProLength = arrPromise.length;
    let timer = setInterval(async () => {
      if (arrPromise.length === arrProLength) {
        clearInterval(timer);
        Promise.all(arrPromise).then(async (res) => {
          setEndAtr(treeObj);
          setMdAtr(treeObj);
          writeAsync(path.join(process.cwd(), '/tree.txt'), endAtr);
          let readtAtr = await readAsync(path.join(process.cwd(), '/README.md'));
          readtAtr += mdAtr;
          writeAsync(path.join(process.cwd(), '/README.md'), readtAtr);
        });
      } else {
        arrProLength = arrPromise.length;
      }
    }, 100);
  });
let endAtr = '';
let mdAtr = '';
// 生成字符串方法
const setEndAtr = (treeObj) => {
  let emptyAtr = '';
  for (let i = 0; i < treeObj.leval; i++) {
    emptyAtr += '    ';
  }
  endAtr += `  ${emptyAtr}--${treeObj.path}\n`;
  treeObj.fileChild.forEach((item) => {
    endAtr += `    ${emptyAtr}${item.name}:${item.info}\n`;
  });
  treeObj.directoryChild.forEach((item) => setEndAtr(item));
};
// 生成md方法
const setMdAtr = (treeObj) => {
  let mdEmptyAtr = '';
  for (let i = 0; i < treeObj.leval; i++) {
    mdEmptyAtr += '&nbsp;&nbsp;&nbsp;&nbsp;';
  }
  mdAtr += `* ${mdEmptyAtr}--${treeObj.path}&nbsp;&nbsp;\n`;
  treeObj.fileChild.forEach((item) => {
    mdAtr += `* &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${mdEmptyAtr}${item.name}:${item.info}&nbsp;&nbsp;\n`;
  });
  treeObj.directoryChild.forEach((item) => setMdAtr(item));
};
