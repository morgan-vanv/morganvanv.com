import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MediaPreviewComponent } from './media-preview';
import { LETTERBOXD_DIARY_URL } from '../../../../shared/letterboxd/letterboxd.service';
import { parseLetterboxdRss } from '../../../../shared/letterboxd/letterboxd';
import { LETTERBOXD_FEED_FIXTURE } from '../../../../shared/letterboxd/letterboxd-feed.fixture';

describe('MediaPreviewComponent', () => {
  async function render(body: object) {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(MediaPreviewComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne(LETTERBOXD_DIARY_URL).flush(body);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the last film watched, with its stars, and is not a link (the tile is the control)', async () => {
    const el = await render(parseLetterboxdRss(LETTERBOXD_FEED_FIXTURE, 'https://letterboxd.com/morganvanv/', '2026-10-27T10:17:00Z'));
    expect(el.querySelector('.label')?.textContent).toContain('Last watched');
    expect(el.querySelector('.title')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Days of Heaven 1978');
    expect(el.querySelector('.stars')?.textContent).toBe('★★★★★');
    expect(el.querySelector('a')).toBeNull();
  });

  it('renders nothing for the placeholder', async () => {
    const el = await render({ note: 'Placeholder' });
    expect(el.textContent?.trim()).toBe('');
  });
});
