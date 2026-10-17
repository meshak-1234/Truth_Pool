// scripts/validate_fandom_datasets.js
// Node script to validate JSON question files in data/ directory
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const REQUIRED_FIELDS = ['id','claim','answer','category','difficulty','explanation','source_name','source_url'];
const VALID_ANSWERS = new Set(['FACT','TRAP']);
const VALID_DIFFICULTIES = new Set(['Easy','Medium','Hard']);

let globalIdSet = new Set();
let globalClaimSet = new Set();
let overall = {totalFiles:0,totalRecords:0,totalValid:0,totalInvalid:0,duplicateIds:[],duplicateClaims:[]};

function validateFile(file){
  const filePath = path.join(DATA_DIR,file);
  const content = fs.readFileSync(filePath,'utf8');
  let records;
  try{records = JSON.parse(content);}catch(e){console.error(`Invalid JSON in ${file}: ${e.message}`);return;}
  if(!Array.isArray(records)){console.error(`${file} does not contain a JSON array`);return;}
  let fileValid=0,fileInvalid=0;
  const localIds = new Set();
  const localClaims = new Set();
  for(const rec of records){
    overall.totalRecords++;
    const missing = REQUIRED_FIELDS.filter(f=>!(f in rec));
    let valid = missing.length===0 && VALID_ANSWERS.has(rec.answer) && VALID_DIFFICULTIES.has(rec.difficulty);
    if(!valid){fileInvalid++;continue;}
    if(globalIdSet.has(rec.id)) overall.duplicateIds.push(rec.id); else globalIdSet.add(rec.id);
    if(localIds.has(rec.id)) overall.duplicateIds.push(rec.id); else localIds.add(rec.id);
    const claimKey = rec.claim.trim().toLowerCase();
    if(globalClaimSet.has(claimKey)) overall.duplicateClaims.push(claimKey); else globalClaimSet.add(claimKey);
    if(localClaims.has(claimKey)) overall.duplicateClaims.push(claimKey); else localClaims.add(claimKey);
    fileValid++;
  }
  overall.totalValid += fileValid;
  overall.totalInvalid += fileInvalid;
  console.log(`${file}: ${records.length} records, ${fileValid} valid, ${fileInvalid} invalid`);
}

function main(){
  const files = fs.readdirSync(DATA_DIR).filter(f=>f.endsWith('.json'));
  overall.totalFiles = files.length;
  for(const f of files) validateFile(f);
  console.log('\n=== Summary ===');
  console.log(`Files processed: ${overall.totalFiles}`);
  console.log(`Total records: ${overall.totalRecords}`);
  console.log(`Valid records: ${overall.totalValid}`);
  console.log(`Invalid records: ${overall.totalInvalid}`);
  console.log(`Duplicate IDs: ${overall.duplicateIds.length}`);
  console.log(`Duplicate claims: ${overall.duplicateClaims.length}`);
}

main();
