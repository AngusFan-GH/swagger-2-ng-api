import axios from 'axios';
import { getTranslatedResult } from './util.js';

export const fetchData = (url) => {
    return new Promise((resolve, reject) => {
        axios.get(url + '/v2/api-docs').then(async (res) => {
            await handle$ref(res.data);
            const definitions = await handleDefinitions(res.data.definitions);
            const data = Object.assign({}, res.data, { definitions });
            resolve(data);
        }).catch((err) => {
            console.error(err);
            reject(err);
        });
    });
};

export const handle$ref = async (obj, parentKey) => {
    if (obj.$ref) {
        const refEn = await getTranslatedResult(obj.$ref);
        obj.$ref = refEn;
    } else {
        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = obj[key];
            if (typeof value === 'object') {
                await handle$ref(value, parentKey ? parentKey + '-' + key : key);
            }
        }
    }
};

export const handleDefinitions = async (definitions) => {
    const res = {};
    for (let i = 0, entityNames = Object.keys(definitions); i < entityNames.length; i++) {
        const entityName = entityNames[i];
        const entityNameEn = await getTranslatedResult(entityName);
        res[entityNameEn] = definitions[entityName];
    };
    return res;
};