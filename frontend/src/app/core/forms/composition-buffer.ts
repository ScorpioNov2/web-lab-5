import { Provider } from '@angular/core';
import { COMPOSITION_BUFFER_MODE } from '@angular/forms';

/**
 * Makes every text field of the app (login, registration, student form...) update its form
 * control on EVERY keystroke, including while an input method is still composing a character.
 *
 * Angular's default holds the value back until the composition ends. With a Vietnamese (Telex /
 * VNI), Chinese or Japanese keyboard the composition ends only when the user presses Space or
 * moves on, so a click on "Войти" / "Добавить" right after the last letter was submitted with an
 * EMPTY field. One provider for the whole app instead of one per component.
 */
export function provideImmediateInput(): Provider {
	return { provide: COMPOSITION_BUFFER_MODE, useValue: false };
}
