{{-- The DEHORS fonts, for the clients that load them (Apple Mail, iOS); the others use the fallbacks. --}}
@php $fontsUrl = rtrim((string)config('app.frontend_url'), '/') . '/fonts'; @endphp
<style>
    @font-face {
        font-family: DehorsFatFrank;
        src: url('{{ $fontsUrl }}/fatfrank.otf') format('opentype');
        font-weight: 400 900;
        font-style: normal;
    }

    @font-face {
        font-family: DehorsAllotrope;
        src: url('{{ $fontsUrl }}/allotrope-medium.otf') format('opentype');
        font-weight: 400 500;
        font-style: normal;
    }

    @font-face {
        font-family: DehorsAllotrope;
        src: url('{{ $fontsUrl }}/allotrope-bold.otf') format('opentype');
        font-weight: 600 900;
        font-style: normal;
    }
</style>
