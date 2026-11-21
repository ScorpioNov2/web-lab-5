import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideImmediateInput } from './composition-buffer';

@Component({
	selector: 'app-ime-host',
	imports: [ReactiveFormsModule],
	template: `<input [formControl]="control" />`,
})
class ImeHost {
	readonly control = new FormControl('', { nonNullable: true });
}

/** What a browser does while a Vietnamese Telex user types "Việt" and has not pressed Space yet. */
function typeWithoutFinishingComposition(input: HTMLInputElement, text: string) {
	input.dispatchEvent(new CompositionEvent('compositionstart'));
	input.value = text;
	input.dispatchEvent(new Event('input'));
}

function render(providers: unknown[]) {
	TestBed.configureTestingModule({ providers: providers as never[] });
	const fixture = TestBed.createComponent(ImeHost);
	fixture.detectChanges();
	const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
	return { control: fixture.componentInstance.control, input };
}

describe('provideImmediateInput', () => {
	it('without it Angular holds the text back while it is being composed (the bug)', () => {
		const { control, input } = render([]);
		typeWithoutFinishingComposition(input, 'Việt');
		expect(control.value).toBe(''); // a submit now would send an empty field
	});

	it('with it the control already holds the text before the composition ends (the fix)', () => {
		const { control, input } = render([provideImmediateInput()]);
		typeWithoutFinishingComposition(input, 'Việt');
		expect(control.value).toBe('Việt');
	});

	it('plain typing keeps working', () => {
		const { control, input } = render([provideImmediateInput()]);
		input.value = 'abc';
		input.dispatchEvent(new Event('input'));
		expect(control.value).toBe('abc');
	});
});
