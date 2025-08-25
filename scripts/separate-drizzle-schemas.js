#!/usr/bin/env node

/**
 * Drizzle Schema Separator
 *
 * Script to separate large Drizzle schema files into separate files
 * with auto-generated relations and smart field name removal.
 *
 * @author Anonymous
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const prettier = require('prettier');

// --- CONFIGURATION ---
const FILE_INPUT = 'src/shared/database/schema/auth.ts';
const OUTPUT_DIRECTORY = 'src/shared/database/schema/auth';
const REMOVE_FIELD_NAMES = true; // Set to false if you don't want to remove field names
const GENERATE_REVERSE_RELATIONS = true; // Set to false if you don't want reverse relations
// --------------------

console.log('🎯 Drizzle Schema Separator v2.0\n');

async function separateSchemas() {
  console.log('🚀 Starting schema separation process...');
  console.log(`📂 Input: ${FILE_INPUT}`);
  console.log(`📁 Output: ${OUTPUT_DIRECTORY}`);

  try {
    // 1. Check if input file exists
    if (!fs.existsSync(FILE_INPUT)) {
      console.error(`❌ Error: Source file '${FILE_INPUT}' not found!`);
      return;
    }

    // 2. Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIRECTORY)) {
      fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
      console.log(`✅ Directory '${OUTPUT_DIRECTORY}' created successfully.`);
    }

    // 3. Read source file content
    const content = fs.readFileSync(FILE_INPUT, 'utf-8');
    console.log(`📖 Reading file ${FILE_INPUT}...`);

    // 4. Prepare drizzle import with namespace
    const drizzleImport = "import * as t from 'drizzle-orm/pg-core';";

    console.log(`📦 Using namespace import for drizzle-orm`);

    // 5. Separate each schema block with more accurate regex
    const schemaRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\([\s\S]*?\}\);/g;
    const schemaMatches = [...content.matchAll(schemaRegex)];

    if (schemaMatches.length === 0) {
      console.log('❌ No schemas found in file. Make sure export const format is correct.');
      return;
    }

    // 6. Parse each schema and transform drizzle functions
    const drizzleFunctions = [
      // Table function
      'pgTable',

      // String types
      'text',
      'varchar',
      'char',

      // Numeric types
      'integer',
      'smallint',
      'bigint',
      'serial',
      'smallserial',
      'bigserial',
      'real',
      'double',
      'doublePrecision',
      'numeric',
      'decimal',

      // Boolean
      'boolean',

      // Date/Time types
      'timestamp',
      'date',
      'time',
      'interval',

      // JSON types
      'json',
      'jsonb',

      // UUID
      'uuid',

      // Binary types
      'bytea',

      // Geometric types
      'point',
      'line',
      'lseg',
      'box',
      'path',
      'polygon',
      'circle',

      // Network types
      'inet',
      'cidr',
      'macaddr',
      'macaddr8',

      // Array type
      'array',

      // Enum
      'pgEnum',

      // Other PostgreSQL specific types
      'xml',
      'money',
      'bit',
      'varbit',
      'tsvector',
      'tsquery',

      // Range types (if any)
      'int4range',
      'int8range',
      'numrange',
      'tsrange',
      'tstzrange',
      'daterange',
    ];

    const transformDrizzleFunctions = code => {
      let transformedCode = code;

      drizzleFunctions.forEach(func => {
        const regex = new RegExp(`\\b${func}\\b`, 'g');
        transformedCode = transformedCode.replace(regex, `t.${func}`);
      });

      // Remove field names if REMOVE_FIELD_NAMES = true
      if (REMOVE_FIELD_NAMES) {
        transformedCode = removeFieldNames(transformedCode);
      }

      return transformedCode;
    };

    // Function to remove field names
    const removeFieldNames = code => {
      // Pattern to match field definitions, but keep if field name differs from camelCase conversion
      return code.replace(
        /(\w+):\s+(t\.\w+)\(["']([\w_]+)["']\)/g,
        (match, fieldName, drizzleFunc, dbFieldName) => {
          // Convert camelCase to snake_case for comparison
          // Handling acronyms properly: credentialID -> credential_id (not credential_i_d)
          const expectedSnakeCase = fieldName
            .replace(/([a-z])([A-Z])/g, '$1_$2') // Insert underscore between lowercase and uppercase
            .toLowerCase();

          // If DB field name matches expected snake_case conversion, remove field name
          if (dbFieldName === expectedSnakeCase) {
            return `${fieldName}: ${drizzleFunc}()`;
          }

          // If different (like credentialID -> credential_i_d), keep FULL field name
          return `${fieldName}: ${drizzleFunc}("${dbFieldName}")`;
        },
      );
    };

    // Function to convert camelCase/PascalCase to kebab-case
    const toKebabCase = str => {
      return str
        .replace(/([a-z])([A-Z])/g, '$1-$2') // Insert dash between lowercase and uppercase
        .toLowerCase();
    };

    const allSchemas = schemaMatches.map(match => {
      const fullMatch = match[0];
      const name = match[1];

      return {
        name,
        code: transformDrizzleFunctions(fullMatch),
        originalCode: fullMatch,
      };
    });

    console.log(`\n🔍 Found ${allSchemas.length} schemas:`);
    allSchemas.forEach((schema, index) => {
      console.log(`   ${index + 1}. ${schema.name}`);
    });

    // 7. Analyze dependencies between schemas and relations
    console.log('\n🔗 Analyzing dependencies and relations...');

    // Collect all relations data first
    const allRelationsData = new Map();

    const analyzeDependencies = schema => {
      const dependencies = [];
      const relations = [];

      allSchemas.forEach(otherSchema => {
        if (schema.name !== otherSchema.name) {
          // Check if this schema references another schema
          const referencePattern = new RegExp(
            `\\.references\\(\\(\\)\\s*=>\\s*${otherSchema.name}\\.([^,)]+)`,
            'g',
          );
          const matches = [...schema.code.matchAll(referencePattern)];

          matches.forEach(match => {
            dependencies.push(otherSchema.name);
            const referencedField = match[1]; // referenced field (e.g.: id)

            // Extract field name that has reference
            const fieldWithRefPattern = new RegExp(
              `(\\w+):[^,}]*\\.references\\(\\(\\)\\s*=>\\s*${otherSchema.name}\\.${referencedField}`,
              'g',
            );
            const fieldMatch = fieldWithRefPattern.exec(schema.code);

            if (fieldMatch) {
              const fieldName = fieldMatch[1]; // e.g.: userId
              const relationName = fieldName.replace(/Id$/, '').replace(/Ids$/, 's');

              relations.push({
                targetSchema: otherSchema.name,
                localField: fieldName,
                referencedField: referencedField,
                relationName: relationName,
              });

              // Store reverse relation data
              if (GENERATE_REVERSE_RELATIONS) {
                if (!allRelationsData.has(otherSchema.name)) {
                  allRelationsData.set(otherSchema.name, []);
                }

                // Generate reverse relation name (pluralize current schema name)
                const reverseRelationName = schema.name; // accounts, sessions, etc

                allRelationsData.get(otherSchema.name).push({
                  type: 'many',
                  relationName: reverseRelationName,
                  targetSchema: schema.name,
                });
              }
            }
          });
        }
      });

      // Remove duplicates
      return {
        dependencies: [...new Set(dependencies)],
        relations: relations,
      };
    };

    // Analyze all schemas first to collect reverse relations
    allSchemas.forEach(schema => {
      analyzeDependencies(schema);
    });

    // 8. Generate file for each schema
    let prettierConfig;
    try {
      // Try to read .prettierrc file manually if resolveConfig fails
      const prettierrcPath = path.join(process.cwd(), '.prettierrc');
      if (fs.existsSync(prettierrcPath)) {
        const prettierrcContent = fs.readFileSync(prettierrcPath, 'utf8');
        prettierConfig = JSON.parse(prettierrcContent);
        console.log('✅ Using config from .prettierrc');
      } else {
        prettierConfig = (await prettier.resolveConfig(process.cwd())) || {};
      }
    } catch (error) {
      console.log('⚠️  Prettier config not found, using default config');
      prettierConfig = {
        singleQuote: true,
        arrowParens: 'avoid',
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        trailingComma: 'all',
      };
    }

    const defaultPrettierConfig = {
      parser: 'typescript',
      ...prettierConfig,
    };

    for (const schema of allSchemas) {
      console.log(`\n📝 Processing ${schema.name}...`);

      // Convert schema name to kebab-case for filename
      const kebabFileName = toKebabCase(schema.name);
      console.log(`   📄 File name: ${kebabFileName}.ts`);

      // Create file content
      let fileContent = '';

      // Analyze and add dependency imports
      const analysis = analyzeDependencies(schema);
      const { dependencies, relations } = analysis;

      // Get reverse relations for this schema
      const reverseRelations = allRelationsData.get(schema.name) || [];
      const allDependenciesForReverse = reverseRelations.map(r => r.targetSchema);
      const totalDependencies = [...new Set([...dependencies, ...allDependenciesForReverse])];

      // Add relations import if there are forward or reverse relations
      if (relations.length > 0 || reverseRelations.length > 0) {
        fileContent += "import { relations } from 'drizzle-orm';\n";
      }

      // Add drizzle import with namespace
      fileContent += drizzleImport + '\n';

      // Add dependency imports (using kebab-case filenames)
      if (totalDependencies.length > 0) {
        console.log(`   🔗 Dependencies: ${totalDependencies.join(', ')}`);
        fileContent += '\n';
        totalDependencies.forEach(dep => {
          const kebabDepName = toKebabCase(dep);
          fileContent += `import { ${dep} } from './${kebabDepName}';\n`;
        });
      }

      fileContent += '\n';

      // Add schema code
      fileContent += schema.code + '\n';

      // Generate relations if any
      const hasForwardRelations = relations.length > 0;
      const hasReverseRelations = reverseRelations.length > 0;

      if (hasForwardRelations || hasReverseRelations) {
        const allRelationNames = [
          ...relations.map(r => r.relationName),
          ...reverseRelations.map(r => r.relationName),
        ];
        console.log(`   🔗 Relations: ${allRelationNames.join(', ')}`);

        fileContent += '\n';

        // Determine which relation types are used
        const usesOne = hasForwardRelations;
        const usesMany = hasReverseRelations;

        // Create destructure with only used types
        let destructure = '({ ';
        const usedTypes = [];
        if (usesOne) usedTypes.push('one');
        if (usesMany) usedTypes.push('many');
        destructure += usedTypes.join(', ') + ' })';

        fileContent += `export const ${schema.name.replace(/s$/, '')}Relations = relations(${schema.name}, ${destructure} => ({\n`;

        // Forward relations (one)
        relations.forEach(relation => {
          fileContent += `  ${relation.relationName}: one(${relation.targetSchema}, {\n`;
          fileContent += `    fields: [${schema.name}.${relation.localField}],\n`;
          fileContent += `    references: [${relation.targetSchema}.${relation.referencedField}],\n`;
          fileContent += `  }),\n`;
        });

        // Reverse relations (many)
        reverseRelations.forEach((relation, index) => {
          const isLast = index === reverseRelations.length - 1 && relations.length === 0;
          fileContent += `  ${relation.relationName}: many(${relation.targetSchema})${isLast ? '' : ','}\n`;
        });

        // Remove trailing comma if exists
        fileContent = fileContent.replace(/,(\s*\}\)\);)$/, '$1');

        fileContent += '}));\n';
      }

      try {
        // Format with Prettier
        const formattedContent = await prettier.format(fileContent, defaultPrettierConfig);

        // Write file with kebab-case name
        const newFilePath = path.join(OUTPUT_DIRECTORY, `${kebabFileName}.ts`);
        fs.writeFileSync(newFilePath, formattedContent);
        console.log(`   ✅ File '${kebabFileName}.ts' created and formatted successfully`);
      } catch (formatError) {
        console.error(`   ⚠️  Error formatting ${schema.name}:`, formatError.message);

        // If prettier fails, write without formatting
        const newFilePath = path.join(OUTPUT_DIRECTORY, `${kebabFileName}.ts`);
        fs.writeFileSync(newFilePath, fileContent);
        console.log(`   ✅ File '${kebabFileName}.ts' created successfully (without formatting)`);
      }
    }

    // 9. Create index file to export all schemas and relations
    console.log('\n📋 Creating index file...');
    let indexContent = '';

    // Sort schemas alphabetically by kebab-case filename for consistent ordering
    const sortedSchemas = allSchemas
      .map(schema => ({
        ...schema,
        kebabFileName: toKebabCase(schema.name),
      }))
      .sort((a, b) => a.kebabFileName.localeCompare(b.kebabFileName));

    sortedSchemas.forEach(schema => {
      indexContent += `export * from './${schema.kebabFileName}';\n`;
    });

    try {
      const formattedIndexContent = await prettier.format(indexContent, defaultPrettierConfig);
      const indexFilePath = path.join(OUTPUT_DIRECTORY, 'index.ts');
      fs.writeFileSync(indexFilePath, formattedIndexContent);
      console.log('✅ index.ts file created successfully');
    } catch (formatError) {
      console.log('⚠️  Index file created without formatting');
      const indexFilePath = path.join(OUTPUT_DIRECTORY, 'index.ts');
      fs.writeFileSync(indexFilePath, indexContent);
    }

    // 10. Show completion summary
    showCompletionSummary(allSchemas.length);

    // 11. Handle original file deletion (optional)
    await handleOriginalFileDeletion();
  } catch (error) {
    console.error('❌ Error in schema separation process:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Show completion summary
function showCompletionSummary(schemaCount) {
  console.log('\n🎉 Process completed! All schemas separated successfully.');
  console.log('\n📊 Summary:');
  console.log(`   • ${schemaCount} schema files created`);
  console.log(`   • 1 index.ts file created`);
  console.log(`   • Location: ${OUTPUT_DIRECTORY}`);

  if (GENERATE_REVERSE_RELATIONS) {
    console.log('   • ✅ Reverse relations enabled');
  }

  if (REMOVE_FIELD_NAMES) {
    console.log('   • ✅ Smart field name removal enabled');
  }

  console.log('\n💡 Tips:');
  console.log('   • Check generated files before committing');
  console.log('   • Update imports in other files if needed');
  console.log('   • Test Drizzle queries to ensure relations work');
}

// Handle original file deletion with user confirmation
async function handleOriginalFileDeletion() {
  const readline = require('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question('\n❓ Do you want to delete the original file? (Y/n): ', answer => {
      rl.close();

      // Default to 'yes' if user just presses ENTER or types 'y'/'Y'/'yes'
      const shouldDelete =
        !answer || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';

      if (shouldDelete) {
        try {
          fs.unlinkSync(FILE_INPUT);
          console.log(`🗑️  Original file '${FILE_INPUT}' deleted successfully.`);
        } catch (error) {
          console.error(`❌ Failed to delete original file: ${error.message}`);
        }
      } else {
        console.log(`✅ Original file '${FILE_INPUT}' kept.`);
      }

      resolve();
    });
  });
}
function validateInputFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const schemaCount = (content.match(/export\s+const\s+\w+\s*=\s*pgTable/g) || []).length;

    console.log(`🔍 Input file validation:`);
    console.log(`   • File size: ${content.length} characters`);
    console.log(`   • Number of schemas found: ${schemaCount}`);

    return schemaCount > 0;
  } catch (error) {
    console.error('❌ Error validating input file:', error.message);
    return false;
  }
}

// Function to clean output directory if exists
function cleanOutputDirectory(outputDir) {
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    const tsFiles = files.filter(file => file.endsWith('.ts'));

    if (tsFiles.length > 0) {
      console.log(`🧹 Cleaning ${tsFiles.length} existing .ts files...`);
      tsFiles.forEach(file => {
        fs.unlinkSync(path.join(outputDir, file));
      });
    }
  }
}

// Main execution with additional options
async function main() {
  console.log('🚀 Starting schema separation...\n');

  // Validate dependencies
  try {
    require('prettier');
  } catch (error) {
    console.error('❌ Prettier not installed. Run: npm install prettier');
    process.exit(1);
  }

  // Validate input file
  if (!validateInputFile(FILE_INPUT)) {
    console.error('❌ Input file is invalid or contains no schemas.');
    process.exit(1);
  }

  // Clean output directory (optional)
  // cleanOutputDirectory(OUTPUT_DIRECTORY);

  // Run main process
  await separateSchemas();
}

// Run program
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}
