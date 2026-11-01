import { expect, it } from 'vitest';
import { input, output, key } from './resources';

it('maps branch fields in both directions and rejects fields without storage rather than silently discarding them', () => {
  expect(input('branches', {name:'Cơ sở A', address:'Hà Nội', phone:'0123456789'})).toEqual({ten_chi_nhanh:'Cơ sở A',dia_chi:'Hà Nội',so_dien_thoai:'0123456789'});
  expect(output('branches', {ma_chi_nhanh:'9007199254740993',ten_chi_nhanh:'Cơ sở A'})).toMatchObject({id:'9007199254740993',name:'Cơ sở A'});
  expect(() => input('roles', {name:'doctor', parent_role_id:'1'})).toThrow(/parent_role_id/);
});

it('preserves internal bigint keys when following ownership relations', () => {
  expect(key('records',9007199254740993n)).toBe('{"ma_ho_so":"9007199254740993"}');
});

it('validates imported CHECK choices before sending an update to Prisma', () => {
  expect(()=>input('patients',{occupation:'Tester'},true)).toThrow(/nghe_nghiep/);
  expect(input('patients',{occupation:'Khac'},true)).toEqual({nghe_nghiep:'Khac'});
});

it('creates a flat role from the name required by the specification', () => {
  expect(input('roles',{name:'data_entry'})).toEqual({ten_vai_tro:'data_entry',ten_hien_thi:'data_entry'});
});
