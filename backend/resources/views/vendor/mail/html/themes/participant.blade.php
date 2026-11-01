{{-- The DEHORS theme with the organizer's color: links, buttons and panels (HasEventBranding). --}}
{!! file_get_contents(resource_path('views/vendor/mail/html/themes/default.css')) !!}

@isset($branding)
a {
    color: {{ $branding->accentDeepColor }};
}

.button-blue,
.button-primary {
    background-color: {{ $branding->accentColor }};
    border: 1px solid {{ $branding->accentColor }};
    color: {{ $branding->accentTextColor }};
}

.panel {
    border-left: {{ $branding->accentColor }} solid 4px;
}

.panel-content {
    background-color: {{ $branding->accentSoftColor }};
}
@endisset
