import {test, expect} from '../fixtures';

test.describe('Dehors homepage', () => {
    test('@smoke visitors can discover pricing and start creating an event', async ({page}) => {
        await page.goto('/?utm_source=homepage-test&utm_campaign=dehors');

        await expect(page.getByRole('heading', {level: 1})).toHaveText('Moins de frais.Plus de monde.');
        await expect(page.locator('#frais')).toContainText(/2,5\s*%/);
        await expect(page.locator('#frais')).toContainText('+ les frais de traitement Stripe');
        await expect(page.locator('#frais')).toContainText(/0\s*\$/);

        await page.getByRole('link', {name: 'Qui paie les frais de billetterie?'}).click();
        await expect(page.getByRole('button', {name: 'Qui paie les frais de billetterie?'})).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#questions')).toContainText('C’est toi qui décides');

        await page.getByTestId('home-create-event').click();
        await expect(page.getByRole('textbox', {name: /E-mail/})).toBeVisible();
        await expect(page).toHaveURL(/\/auth\/register\?utm_source=homepage-test&utm_campaign=dehors$/);
    });

    test('language selection persists after reload and on the login page', async ({page}) => {
        await page.goto('/');
        await page.getByTestId('home-language-toggle').click();

        await expect(page.getByRole('heading', {level: 1})).toHaveText('Lower fees.More together.');
        await expect(page.locator('#frais')).toContainText('2.5%');
        await page.reload();
        await expect(page.getByRole('heading', {level: 1})).toHaveText('Lower fees.More together.');

        await page.getByRole('link', {name: 'Log in', exact: true}).click();
        await expect(page.getByRole('button', {name: 'Log in', exact: true})).toBeVisible();
    });

    test('mobile visitors can read the page and reach registration', async ({page}) => {
        await page.setViewportSize({width: 320, height: 844});
        await page.goto('/');

        await expect(page.getByRole('heading', {level: 1})).toBeVisible();
        await expect(page.getByRole('heading', {name: 'Événements payants', exact: true})).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(await page.locator('#frais').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);

        await page.getByTestId('home-create-event').click();
        await expect(page.getByRole('textbox', {name: /E-mail/})).toBeVisible();
    });
});
