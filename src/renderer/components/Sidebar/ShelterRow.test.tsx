import { render, screen, fireEvent } from '@testing-library/react';
import ShelterRow from './ShelterRow';
import type { Shelter } from '@shared/ipc-types';

const shelter: Shelter = {
  id: 42,
  name: 'Bear Notch Shelter',
  slug: 'bear-notch-shelter',
  start_year: 1940,
  end_year: null,
  description: '',
  category: 'lean-to',
  architecture: '',
  built_by: '',
  notes: '',
  is_extant: true,
  is_gmc: false,
  show_on_web: false,
  default_photo_id: null,
  default_photo_file_name: null,
  created: '2020-01-01',
  updated: '2020-01-01',
  photo_count: 0,
};

describe('ShelterRow', () => {
  it('renders shelter name', () => {
    render(<ShelterRow shelter={shelter} selected={false} onSelect={jest.fn()} collapsed={false} />);
    expect(screen.getByText('Bear Notch Shelter')).toBeInTheDocument();
  });

  it('applies selected class when selected', () => {
    const { container } = render(
      <ShelterRow shelter={shelter} selected={true} onSelect={jest.fn()} collapsed={false} />,
    );
    expect(container.firstChild).toHaveClass('selected');
  });

  it('does not apply selected class when not selected', () => {
    const { container } = render(
      <ShelterRow shelter={shelter} selected={false} onSelect={jest.fn()} collapsed={false} />,
    );
    expect(container.firstChild).not.toHaveClass('selected');
  });

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<ShelterRow shelter={shelter} selected={false} onSelect={onSelect} collapsed={false} />);
    fireEvent.click(screen.getByText('Bear Notch Shelter'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows extant class for extant shelter', () => {
    const { container } = render(
      <ShelterRow shelter={shelter} selected={false} onSelect={jest.fn()} collapsed={false} />,
    );
    expect(container.querySelector('.shelter-item-thumb')).toHaveClass('extant');
  });

  it('shows gone class for non-extant shelter', () => {
    const gone = { ...shelter, is_extant: false };
    const { container } = render(
      <ShelterRow shelter={gone} selected={false} onSelect={jest.fn()} collapsed={false} />,
    );
    expect(container.querySelector('.shelter-item-thumb')).toHaveClass('gone');
  });

  it('uses first letter of name (skipping articles) as initial', () => {
    const { container } = render(
      <ShelterRow shelter={shelter} selected={false} onSelect={jest.fn()} collapsed={false} />,
    );
    expect(container.querySelector('.shelter-item-thumb')?.textContent).toBe('B');
  });

  it('skips "The " prefix for initial', () => {
    const theShelter = { ...shelter, name: 'The Boiling Spring' };
    const { container } = render(
      <ShelterRow shelter={theShelter} selected={false} onSelect={jest.fn()} collapsed={false} />,
    );
    expect(container.querySelector('.shelter-item-thumb')?.textContent).toBe('B');
  });

  it('shows initial when no default photo is set', () => {
    const { container } = render(
      <ShelterRow shelter={shelter} selected={false} onSelect={jest.fn()} collapsed={false} repoRoot="/repo" sheltersRoot="shelters/" />,
    );
    expect(container.querySelector('.shelter-item-thumb img')).toBeNull();
    expect(container.querySelector('.shelter-item-thumb')?.textContent).toBe('B');
  });

  it('shows thumbnail img when default photo file name is set', () => {
    const withPhoto = { ...shelter, default_photo_id: 7, default_photo_file_name: 'shelters/bear-notch-shelter/photo.jpg' };
    const { container } = render(
      <ShelterRow shelter={withPhoto} selected={false} onSelect={jest.fn()} collapsed={false} repoRoot="/repo" sheltersRoot="shelters/" />,
    );
    const img = container.querySelector('.shelter-item-thumb img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('bear-notch-shelter');
  });
});
