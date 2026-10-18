import type { City, CityLink } from '../components/types';

const modules = import.meta.glob('./*.json', {
  eager: true,
  import: 'default',
}) as Record<string, City>;

export const getCities = (): City[] => Object.values(modules);
export const getCityLinks = (): CityLink[] =>
  getCities().map(({ id, name }) => ({ id, name }));
