import theme from './index';

describe('MUI theme', () => {
  it('primary.main is forest green', () => {
    expect(theme.palette.primary.main).toBe('#2d4a32');
  });

  it('primary.dark is forest deep', () => {
    expect(theme.palette.primary.dark).toBe('#1f3524');
  });

  it('secondary.main is rust', () => {
    expect(theme.palette.secondary.main).toBe('#b54d2c');
  });

  it('secondary.dark is rust deep', () => {
    expect(theme.palette.secondary.dark).toBe('#8e3a1f');
  });

  it('background.default is parchment', () => {
    expect(theme.palette.background.default).toBe('#f3ecdb');
  });

  it('background.paper is surface', () => {
    expect(theme.palette.background.paper).toBe('#faf4e3');
  });
});
