import { writeFileSync } from 'fs';
import * as path from 'path';
import config from '../config.json' assert { type: 'json' };
import { fetchData } from './fetch-data.js';
import { InterfaceGenerator } from './interface.generator.js';
import { NgFileGenerator } from './ngfile.generator.js';
import { PathAnalyzer } from './path.analyzer.js';
import { deleteFolderFiles, getKebabCase, makeDir } from './util.js';


(async () => {
    const apiPath = path.join(process.cwd(), config.outputPath || './api');
    deleteFolderFiles(apiPath);
    const entityPath = path.join(apiPath, 'entitys');
    makeDir(entityPath);
    const swaggerJSON = await fetchData(config.swaggerUrl);
    writeFileSync(path.join(apiPath, 'swagger.json'), JSON.stringify(swaggerJSON, null, 4));

    const definitions = swaggerJSON.definitions;
    Object.keys(definitions).forEach(async (entityName) => {
        const generator = new InterfaceGenerator(entityName, definitions[entityName]);
        const result = generator.print();
        writeFileSync(path.join(entityPath, getKebabCase(generator.name) + '.ts'), result);
    });

    const paths = swaggerJSON.paths;
    const filesMapping = Object.create(null);
    Object.keys(paths).forEach((path) => {
        new PathAnalyzer(path, paths[path], filesMapping);
    });
    console.log("🚀 ~ file: index.js:30 ~ Object.keys ~ filesMapping:", filesMapping.wb.importNode, filesMapping.wb.requests);
    const ngFileGenerator = new NgFileGenerator(filesMapping, config.basePath);
    const files = ngFileGenerator.files;
    const apisPath = path.join(apiPath, 'apis');
    makeDir(apisPath);
    files.forEach((_) => {
        writeFileSync(path.join(apisPath, _.fileName), _.fileContent);
    });
    writeFileSync(path.join(apiPath, './api.module.ts'), ngFileGenerator.ngModuleFileContent);
})();

