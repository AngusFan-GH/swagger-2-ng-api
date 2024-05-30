import { fixEntityName, getKebabCase, typeMap } from "./util.js";

export class PathAnalyzer {
    constructor(path, def, fileMapping) {
        this.path = path;
        this.url = path;
        this.def = def;
        this.fileMapping = fileMapping;
        this.group = null;
        this.config = {
            importNode: [],
            requests: [],
        };
        this.pathParams = [];
        this.splitPath();
        this.createFile();
        this.handleRequest();
    }
    createFile() {
        if (this.fileMapping[this.group] == null) {
            this.fileMapping[this.group] = this.config;
        } else {
            this.config = this.fileMapping[this.group];
        }
    }
    splitPath() {
        this.group = this.path.split('/').filter(_ => _ !== '')[0];
        this.pathParams.push(...this.url.match(/(?<=\{)(.*?)(?=\})/g) || []);
    }
    handleRequest() {
        Object.keys(this.def).forEach(method => {
            const item = this.def[method];
            const itemConfig = {
                method,
                summary: item.summary,
                url: this.url,
                pathParams: this.pathParams,
                postBodyType: null,
                responseType: null,
                queryParams: []
            };
            if (item.parameters) {
                item.parameters.forEach((config) => {
                    if (method === 'post' && config.in == 'body') {
                        if (config.schema && config.schema.$ref) {
                            itemConfig.postBodyType = this.handleRef(config.schema.$ref);
                        }
                    } else if (method === 'post' && config.in == 'formData') {
                        if (!itemConfig.postBodyType) {
                            itemConfig.postBodyType = {};
                        }
                        itemConfig.postBodyType[config.name] = this.handelParamsDef(config);
                    } else if (method === 'get' && config.in === 'query') {
                        const obj = {};
                        obj[config.name] = config.type;
                        itemConfig.queryParams.push(obj);
                    } else if (config.in === 'path') {
                    } else {
                        console.log('未处理的请求方式:', this.path);
                    }
                });
            } else {
                switch (method) {
                    case 'post':
                        break;
                    case 'get':
                        break;
                }
            }
            const response = item.responses['200'];
            if (response.schema && response.schema.$ref) {
                itemConfig.responseType = this.handleRef(response.schema.$ref);
            } else {
                itemConfig.responseType = 'any';
                console.log('另类的返回结果:', this.path);
            }
            this.config.requests.push(itemConfig);
        });
    }
    handelParamsDef(def) {
        if (def.type === 'array') {
            if (Object.keys(def.items).length == 1 && def.items.type) {
                return typeMap[def.items.type] + '[]';
            }
        }
        return def.type;
    }
    handleRef($ref) {
        const key = $ref.replace(/^#\/definitions\//, '');
        const ref = fixEntityName(key);
        this.config.importNode.push({
            import: ref,
            from: `./${getKebabCase(ref)}`
        });
        return ref;
    }
}