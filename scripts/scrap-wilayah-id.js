// @ts-check

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDefined, assertPropArrayMapOf, assertPropString } from 'typeshaper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const provicesResp = await fetch('https://wilayah.id/api/provinces.json');
/** @type {unknown} */
const provinces = await provicesResp.json();

assertDefined(provinces);
assertPropArrayMapOf(provinces, 'data', function (province) {
  assertDefined(province);
  assertPropString(province, 'code');
  return province;
});

const apiDir = join(__dirname, '../data/api');
await mkdir(apiDir, { recursive: true });
await writeFile(join(apiDir, 'provinces.json'), JSON.stringify(provinces), { encoding: 'utf-8' });

/** @type {Array<Array<string>>} */
const provinceBatches = [[]];
const numOfProvincesPerBatch = 2;
for (const province of provinces.data) {
  const currentBatch = provinceBatches[provinceBatches.length - 1];
  if (currentBatch.length >= numOfProvincesPerBatch) {
    provinceBatches.push([]);
  }
  provinceBatches[provinceBatches.length - 1].push(province.code);
}

for (const provinceBatch of provinceBatches) {
  await Promise.all(provinceBatch.map(async function (provinceCode) {
    let regencies = /** @type {unknown} */ (undefined);
    const regenciesPath = join(apiDir, 'regencies', `${provinceCode}.json`);
    if (existsSync(regenciesPath)) {
      const regenciesFile = await readFile(regenciesPath, { encoding: 'utf-8' });
      regencies = JSON.parse(regenciesFile);
    } else {
      const regenciesResp = await fetch(`https://wilayah.id/api/regencies/${provinceCode}.json`);
      /** @type {unknown} */
      regencies = await regenciesResp.json();
      const regenciesDir = dirname(regenciesPath);
      await mkdir(regenciesDir, { recursive: true });
      await writeFile(regenciesPath, JSON.stringify(regencies), { encoding: 'utf-8' });
    }
    console.log(provinceCode);
    assertDefined(regencies);
    assertPropArrayMapOf(regencies, 'data', function (regency) {
      assertDefined(regency);
      assertPropString(regency, 'code');
      return regency;
    });
    for (const regency of regencies.data) {
      let districts = /** @type {unknown} */ (undefined);
      const districtsPath = join(apiDir, 'districts', `${regency.code}.json`);
      if (existsSync(districtsPath)) {
        const districtsFile = await readFile(districtsPath, { encoding: 'utf-8' });
        districts = JSON.parse(districtsFile);
      } else {
        const districtsResp = await fetch(`https://wilayah.id/api/districts/${regency.code}.json`);
        /** @type {unknown} */
        districts = await districtsResp.json();
        const districtsDir = dirname(districtsPath);
        await mkdir(districtsDir, { recursive: true });
        await writeFile(districtsPath, JSON.stringify(districts), { encoding: 'utf-8' });
      }
      console.log(regency.code);
      assertDefined(districts);
      assertPropArrayMapOf(districts, 'data', function (district) {
        assertDefined(district);
        assertPropString(district, 'code');
        return district;
      });
      for (const district of districts.data) {
        const villagesPath = join(apiDir, 'villages', `${district.code}.json`);
        if (existsSync(villagesPath)) {
          continue;
        } else {
          const villagesResp = await fetch(`https://wilayah.id/api/villages/${district.code}.json`);
          const villagesJson = await villagesResp.text();
          const villagesDir = dirname(villagesPath);
          await mkdir(villagesDir, { recursive: true });
          await writeFile(join(villagesDir, `${district.code}.json`), villagesJson, { encoding: 'utf-8' });
        }
        console.log(district.code);
      }
    }
  }));
}
