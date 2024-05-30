import axios from 'axios';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import md5 from 'md5';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.json' assert { type: 'json' };

class Translator {
    url = 'https://fanyi-api.baidu.com/api/trans/vip/translate';

    constructor(config) {
        this.cachePath = path.join(path.dirname(fileURLToPath(import.meta.url)), config.cachePath, 'cache.json');
        this.appid = config.appid;
        this.secret = config.secret;
        try {
            existsSync(this.cachePath) || writeFileSync(this.cachePath, '{}');
            const data = readFileSync(this.cachePath, 'utf8');
            this.cache = JSON.parse(data);
        } catch (e) {
            this.cache = {};
            console.error(e);
        }
    }

    async translate(str) {
        if (this.cache[str] != null) {
            if (this.cache[str] instanceof Promise) {
                return await this.cache[str];
            } else if (typeof this.cache[str] === 'string') {
                return Promise.resolve(this.cache[str]);
            }
        }
        const salt = (new Date).getTime();
        const sign = md5(this.appid + str + salt + this.secret);
        const params = {
            q: str,
            from: 'zh',
            to: 'en',
            appid: this.appid,
            salt,
            sign
        };
        const request = new Promise((resolve, reject) => {
            const query = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');
            console.log('Start translate query:', str);
            axios.get(this.url + '?' + query).then((res) => {
                if (res.data.error_code) {
                    resolve(str);
                    console.error('ERROR when query "' + str + '":', res.data.error_msg, ', please try again later.');
                    return;
                }
                const word = res.data.trans_result[0].dst;
                this.cache[str] = word;
                writeFileSync(this.cachePath, JSON.stringify(this.cache), (err) => {
                    if (err) {
                        console.error(err);
                    }
                });
                console.log(`Finish translate ${str}:`, word);
                resolve(word);
            }).catch((err) => {
                reject(err);
            });
        });
        this.cache[str] = request;
        return request;
    };
}

export default new Translator(config);