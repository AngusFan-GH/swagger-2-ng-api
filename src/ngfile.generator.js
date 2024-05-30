import * as path from 'path';
import ts from 'typescript';
import { fixEntityName, getKebabCase, typeMap } from './util.js';

const { factory } = ts;

const {
    createPropertySignature,
    createTypeReferenceNode,
    createInterfaceDeclaration,
    createIdentifier,
    createImportDeclaration,
    createStringLiteral,
    createImportSpecifier,
    createNamedImports,
    createModifiersFromModifierFlags,
    createToken,
    createClassDeclaration,
    createDecorator,
    createParameterDeclaration,
    createConstructorDeclaration,
    createBlock,
    createMethodDeclaration,
    createReturnStatement,
    createPropertyAccessExpression,
    createThis,
    createCallExpression,
    createAsExpression,
    createObjectLiteralExpression,
    createShorthandPropertyAssignment,
    createSourceFile,
    createPropertyAssignment,
    createArrayLiteralExpression
} = factory;


const exportModifier = createModifiersFromModifierFlags(
    ts.ModifierFlags.Export
);
const privateModifier = createModifiersFromModifierFlags(
    ts.ModifierFlags.Private
);
const publicModifier = createModifiersFromModifierFlags(
    ts.ModifierFlags.Public
);


export class NgFileGenerator {
    files = [];
    importAPIs = [];
    basePath = '/';
    ngModuleFileContent = '';
    constructor(def, basePath) {
        if (basePath) {
            this.basePath = basePath;
        }
        this.ngModuleFileContent = '';
        Object.keys(def).forEach((_) => {
            this.createApiFile(_, def[_]);
        });
        this.createNgModule();
    }
    createNgModule() {
        const importNode = [];
        const sourcefile = createSourceFile([], createToken(ts.SyntaxKind.EndOfFileToken), ts.ScriptTarget.ES2018);
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });
        this.addImports(importNode, 'NgModule', '@angular/core');
        this.addImports(importNode, 'HttpClientModule', '@angular/common/http');
        this.importAPIs.forEach(({ fileName, className }) => {
            this.addImports(importNode, className, './apis/' + fileName);
        });
        let result = '';
        if (importNode.length > 0) {
            importNode.forEach(_ => {
                result += printer.printNode(ts.EmitHint.Unspecified, _, sourcefile) + '\n';
            });
        }
        result += '\n';
        const classDec = createClassDeclaration(
            [
                createDecorator(
                    createCallExpression(
                        createIdentifier("NgModule"),
                        undefined,
                        [createObjectLiteralExpression(
                            [
                                createPropertyAssignment(
                                    createIdentifier("imports"),
                                    createArrayLiteralExpression(
                                        [createIdentifier("HttpClientModule")],
                                        true
                                    )
                                ),
                                createPropertyAssignment(
                                    createIdentifier("providers"),
                                    createArrayLiteralExpression(
                                        this.importAPIs.map(_ => createIdentifier(_.className)),
                                        true
                                    )
                                )
                            ],
                            true
                        )]
                    )
                )
            ],
            exportModifier,
            createIdentifier("APIModule"),
            undefined,
            undefined,
            []
        );
        result += printer.printNode(ts.EmitHint.Unspecified, classDec, sourcefile) + '\n';
        this.ngModuleFileContent = result;
    }
    createApiFile(name, config) {
        name = name.slice(0, 1).toUpperCase() + name.slice(1);
        const importNode = [];
        const interfaces = [];
        config.importNode.forEach(_ => {
            _.from = path.join('../entitys', _.from).replace(/\\/g, '/');
            this.addImports(importNode, 'Injectable', '@angular/core');
            this.addImports(importNode, 'HttpClient', '@angular/common/http');
            this.addImports(importNode, 'Observable', 'rxjs');
            this.addImports(importNode, _.import, _.from);
        });
        const decorator = createDecorator(createIdentifier('Injectable()'));
        const constructorParam = createParameterDeclaration(
            undefined,
            privateModifier,
            undefined,
            createIdentifier('$http'),
            undefined,
            createIdentifier('HttpClient')
        );
        const constructorDec = createConstructorDeclaration(undefined, undefined, [constructorParam], createBlock([], true));
        const methods = [];
        config.requests.forEach((item) => {
            const methodName = item.url.replace(/{|}/g, '').split('/').filter(_ => _ != '').reverse().map((_, idx) => {
                if (idx > 0) {
                    return _.slice(0, 1).toUpperCase() + _.slice(1);
                }
                return _;
            }).join('');
            item.url = item.url.replace(/{/g, '${');
            const responseType = createTypeReferenceNode('Observable', [createTypeReferenceNode(item.responseType || 'any', undefined)]);
            const params = [];
            let statement = [];
            item.pathParams.forEach((pathParam) => {
                params.push(
                    createParameterDeclaration(
                        undefined,
                        undefined,
                        undefined,
                        createIdentifier(pathParam),
                        undefined,
                        createIdentifier('string | number')
                    )
                );
            });
            switch (item.method) {
                case 'post':
                    if (item.postBodyType && Object.prototype.toString.apply(item.postBodyType) === '[object String]') {
                        params.push(
                            createParameterDeclaration(
                                undefined,
                                undefined,
                                undefined,
                                createIdentifier('params'),
                                undefined,
                                createIdentifier(item.postBodyType)
                            )
                        );
                    } else if (item.postBodyType && Object.prototype.toString.apply(item.postBodyType) === '[object Object]') {
                        const tmp = this.createLocalInterface(methodName + 'ParamsType', item.postBodyType);
                        interfaces.push(tmp.interface);
                        params.push(
                            createParameterDeclaration(
                                undefined,
                                undefined,
                                undefined,
                                createIdentifier('params'),
                                undefined,
                                createIdentifier(tmp.name)
                            )
                        );
                    } else {
                        params.push(
                            createParameterDeclaration(
                                undefined,
                                undefined,
                                undefined,
                                createIdentifier('params'),
                                undefined,
                                createIdentifier('any'),
                                createIdentifier('{}')
                            )
                        );
                    }
                    statement.push(
                        createReturnStatement(
                            createAsExpression(
                                createCallExpression(
                                    createPropertyAccessExpression(
                                        createThis(),
                                        createPropertyAccessExpression(createIdentifier('$http'), createIdentifier(item.method))
                                    ),
                                    undefined,
                                    [createIdentifier(`\`${path.join(this.basePath, item.url)}\``.replace(/\\/g, '/')), createIdentifier(`params`)],
                                ),
                                responseType
                            )
                        )
                    );
                    break;
                case 'get':
                    if (item.queryParams.length > 0) {
                        const tmp = this.createLocalInterface(methodName + 'ParamsType', item.queryParams[0]);
                        interfaces.push(tmp.interface);
                        params.push(
                            createParameterDeclaration(
                                undefined,
                                undefined,
                                undefined,
                                createIdentifier('params'),
                                undefined,
                                createIdentifier(tmp.name)
                            )
                        );
                    }
                    statement.push(
                        createReturnStatement(
                            createAsExpression(
                                createCallExpression(
                                    createPropertyAccessExpression(
                                        createPropertyAccessExpression(
                                            createThis(),
                                            createIdentifier('$http'),
                                        ),
                                        createIdentifier(item.method)
                                    ),
                                    undefined,
                                    [
                                        createIdentifier(`\`${path.join(this.basePath, item.url)}\``.replace(/\\/g, '/')),
                                        createObjectLiteralExpression(
                                            [
                                                createShorthandPropertyAssignment(
                                                    createIdentifier("params"),
                                                    undefined
                                                )
                                            ],
                                            false
                                        )
                                    ].slice(0, item.queryParams.length > 0 ? 2 : 1),
                                ),
                                responseType
                            )
                        )
                    );
                    break;
            }
            const method = createMethodDeclaration(
                undefined,
                publicModifier,
                undefined,
                createIdentifier(methodName),
                undefined,
                undefined,
                params,
                responseType,
                createBlock(statement, true)
            );
            if (item.summary) {
                ts.addSyntheticLeadingComment(method, ts.SyntaxKind.MultiLineCommentTrivia,
                    `*\n * ${item.summary}\n `, true);
            }
            methods.push(method);
        });
        const className = fixEntityName(name + 'API');
        const classDec = createClassDeclaration(
            [decorator],
            exportModifier,
            createIdentifier(className),
            undefined,
            undefined,
            [constructorDec, ...methods]
        );
        const fileContent = this.print(importNode, interfaces, classDec);
        const fileName = `${getKebabCase(name)}.api`;
        this.importAPIs.push({ fileName, className });
        this.files.push({
            fileName: `${fileName}.ts`,
            fileContent
        });
    }
    addImports = (importNode, something, from) => {
        const existNode = importNode.find(_ => {
            return _.moduleSpecifier.text === from;
        });
        if (existNode) {
            const existElement = existNode.importClause.elements.find(_ => {
                return _.name.escapedText === something;
            });
            if (!existElement) {
                existNode.importClause.elements.push(
                    createImportSpecifier(false, createIdentifier(something))
                );
            }
            return;
        }
        importNode.push(
            createImportDeclaration(
                undefined,
                undefined,
                createNamedImports([
                    createImportSpecifier(false, createIdentifier(something))
                ]),
                createStringLiteral(from))
        );
    };
    print(importNode, interfaces, classDec) {
        const sourcefile = createSourceFile([], createToken(ts.SyntaxKind.EndOfFileToken), ts.ScriptTarget.ES2018);
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });
        let result = '';
        if (importNode.length > 0) {
            importNode.forEach(_ => {
                result += printer.printNode(ts.EmitHint.Unspecified, _, sourcefile) + '\n';
            });
        }
        if (result != '') {
            result += '\n';
        }
        (interfaces || []).forEach(_ => {
            result += printer.printNode(ts.EmitHint.Unspecified, _, sourcefile);
            result += '\n';
        });

        result += printer.printNode(ts.EmitHint.Unspecified, classDec, sourcefile) + '\n';

        return result;
    }
    createLocalInterface(name, config) {
        name = name.slice(0, 1).toUpperCase() + name.slice(1);
        const props = [];
        Object.keys(config).forEach((key) => {
            props.push(
                createPropertySignature(
                    undefined,
                    createIdentifier(key),
                    createToken(ts.SyntaxKind.QuestionToken),
                    createTypeReferenceNode(typeMap[config[key]] || config[key])
                )
            );
        });
        return {
            interface: createInterfaceDeclaration(
                undefined,
                exportModifier,
                createIdentifier(name),
                undefined,
                undefined,
                props
            ),
            name
        };
    }
}
