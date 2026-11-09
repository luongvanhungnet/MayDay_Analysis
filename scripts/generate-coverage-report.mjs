import { execSync } from 'node:child_process';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL;

const sql = `
SELECT 
  t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
`;

const res = execSync(`psql "${dbUrl}" -t -A -c "${sql.replace(/\n/g, ' ')}"`, { encoding: 'utf8' });
const tables = res.trim().split('\n').filter(Boolean);

console.log(`| # | Tên bảng (Table Name) | Số dòng (Rows) | Tỷ lệ phủ (Coverage) |`);
console.log(`|---|---|---|---|`);

let covered = 0;
tables.forEach((t, i) => {
  const cnt = parseInt(execSync(`psql "${dbUrl}" -t -A -c "SELECT count(*) FROM \\"${t}\\";"`, { encoding: 'utf8' }).trim(), 10);
  if (cnt > 0) covered++;
  console.log(`| ${i + 1} | \`${t}\` | ${cnt} | ${cnt > 0 ? '✅ 100%' : '❌ 0%'} |`);
});

console.log(`\nTổng số bảng: ${tables.length}`);
console.log(`Số bảng có dữ liệu: ${covered}`);
console.log(`Tỷ lệ bao phủ toàn bộ database: ${((covered / tables.length) * 100).toFixed(2)}%`);
