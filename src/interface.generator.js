import { fixEntityName, getKebabCase, typeMap } from "./util.js";

import ts from 'typescript';

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
} = factory;

const exportModifier = createModifiersFromModifierFlags(
    ts.ModifierFlags.Export
);




export class InterfaceGenerator {
    constructor(name, def, importNode = [], entitys = [], entityNames = []) {
        name = fixEntityName(name);
        this.name = name.slice(0, 1).toUpperCase() + name.slice(1);
        this.type = this.name;
        this.def = def;
        this.importNode = importNode;
        this.entitys = entitys;
        this.entityNames = entityNames;
        this.handleDefinition();
    }
    handleDefinition() {
        switch (this.def.type) {
            case 'object':
                this.handleObject();
                break;
            case 'array':
                this.handleArray();
                break;
            default:
                const type = this.def.type;
                if (type == null && this.def.$ref) {
                    this.handleRef(this.def.$ref);
                }
        }
    }
    handleArray() {
        if (this.def.items && this.def.items.$ref) {
            this.type = this.handleRef(this.def.items.$ref) + '[]';
        } else if (this.def.items && this.def.items.type != null) {
            this.type = (typeMap[this.def.items.type] || this.def.items.type) + '[]';
        } else {
            console.log('other array def');
        }
    }
    handleRef($ref) {
        const key = $ref.replace(/^#\/definitions\//, '');
        const ref = fixEntityName(key);
        if (!this.entityNames.includes(ref)) {
            this.addImports(ref, `./${getKebabCase(ref)}`);
        }
        this.type = ref;
        return ref;
    }
    addImports = (something, from) => {
        const existNode = this.importNode.find(_ => {
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
        this.importNode.push(
            createImportDeclaration(
                undefined,
                undefined,
                createNamedImports([
                    createImportSpecifier(false, createIdentifier(something))
                ]),
                createStringLiteral(from))
        );
    };
    handleObject() {
        this.entityNames.push(this.name);
        let props = [];
        const def = this.def;
        if (def.properties) {
            Object.keys(def.properties).forEach((key) => {
                const item = def.properties[key];
                const javaType = item.type;
                let type = typeMap[javaType];
                let prop;

                if (!type) {
                    const child = new InterfaceGenerator(key, item, this.importNode, this.entitys, this.entityNames);
                    type = child.type;
                }
                if (type) {
                    prop = createPropertySignature(
                        undefined,
                        createIdentifier(key),
                        createToken(ts.SyntaxKind.QuestionToken),
                        createTypeReferenceNode(type)
                    );
                } else {
                    console.log(`missing object type:'${item.type} handler`);
                }
                if (item.description && prop) {
                    ts.addSyntheticLeadingComment(prop, ts.SyntaxKind.MultiLineCommentTrivia,
                        `*\n * ${item.description}\n `, true);
                }
                if (prop) {
                    props.push(prop);
                }
            });

        }
        if (def.additionalProperties) {
            if (Object.keys(def.additionalProperties).length == 1 && def.additionalProperties.type === 'string') {
                const prop = createPropertySignature(
                    undefined,
                    createIdentifier('[key:string]'),
                    undefined,
                    createTypeReferenceNode('any')
                );
                if (def.description && prop) {
                    ts.addSyntheticLeadingComment(prop, ts.SyntaxKind.MultiLineCommentTrivia,
                        `*\n * ${def.description}\n `, true);
                }
                if (prop) {
                    props.push(prop);
                }
            }
        }

        const entity = createInterfaceDeclaration(
            undefined,
            exportModifier,
            createIdentifier(this.name),
            undefined,
            undefined,
            props
        );
        this.entitys.push(entity);
        return this.name;
    }
    print() {
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });
        let result = '';
        if (this.importNode.length > 0) {
            this.importNode.forEach(_ => {
                result += printer.printNode(ts.EmitHint.Unspecified, _) + '\n';
            });
        }
        if (result != '') {
            result += '\n';
        }
        this.entitys.forEach(entity => {
            result += printer.printNode(ts.EmitHint.Unspecified, entity) + '\n';
        });
        return result;
    }
}

