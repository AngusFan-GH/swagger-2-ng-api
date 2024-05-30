import { existsSync, lstatSync, mkdirSync, readdirSync, rmdirSync, unlinkSync } from 'fs';
import translator from './translator/translator.js';

import * as path from 'path';
export const typeMap = {
    integer: 'number',
    number: 'number',
    string: 'string',
    boolean: 'boolean',
    file: 'File'
};

export const isWin = process.platform === 'win32';

export const makeDir = (dirPath) => {
    if (!existsSync(dirPath)) {
        let pathTmp;
        const split = isWin ? '\\' : '/';
        dirPath.split(split).forEach(function (dirname) {
            if (pathTmp) {
                pathTmp = path.join(pathTmp, dirname);
            }
            else {
                if (dirname) {
                    pathTmp = dirname;
                } else {
                    pathTmp = split;
                }
            }
            if (!existsSync(pathTmp)) {
                if (!mkdirSync(pathTmp)) {
                    return false;
                }
            }
        });
    }
    return true;
};

export const deleteFolderFiles = (folderPath) => {
    if (!existsSync(folderPath)) return;
    readdirSync(folderPath).forEach((file) => {
        const curPath = path.join(folderPath, file);
        if (lstatSync(curPath).isDirectory()) {
            deleteFolderFiles(curPath);
        } else {
            unlinkSync(curPath);
        }
    });
    rmdirSync(folderPath);
};

export const getKebabCase = (str) => {
    return str.replace(/([A-Z])/g, (match, p1, offset, str) => {
        return (offset === 0 ? '' : '-') + match.toLowerCase();
    });
};

export const fixEntityName = (entityName) => {
    let symbol = [],
        value = [],
        res = '';
    entityName = entityName.replace(/Map\«string\,(.+?)\»/g, (match, p1, offset, str) => {
        return p1.slice(0, 1).toUpperCase() + p1.slice(1) + 'Map';
    });
    entityName.split(/([«»\(\)（）])/).filter(_ => _ != '').forEach((item) => {
        switch (true) {
            case /[\«（\(]/.test(item):
                symbol.push(item);
                break;
            case /[\»）\)]/.test(item):
                while (symbol.length) {
                    let mid = symbol.pop();
                    if (mid !== '»' && mid !== ')' && mid !== '）') {
                        res += value.pop();
                    } else break;
                }
                break;
            default:
                value.push(item);
                break;
        }
    });
    const str = res + value.join('');
    return str.slice(0, 1).toUpperCase() + str.slice(1);
};

export const toCamelCase = (str) => {
    return str.replace(/( |^)[a-z]/g, (L) => L.toUpperCase()).replace(/ /g, '');
};

export const getTranslatedResult = async (str) => {
    try {
        const chineseBlock = str.match(/[\u4e00-\u9fa5]+/g);
        if (chineseBlock && chineseBlock.length > 0) {
            for (let i = 0; i < chineseBlock.length; i++) {
                const word = chineseBlock[i];
                let translatedWord = await translator.translate(word);
                translatedWord = toCamelCase(translatedWord);
                str = str.replace(word, translatedWord);
            }
        };
        return str;
    } catch (err) {
        console.error(err);
        return str;
    }
};