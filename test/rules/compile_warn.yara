/*
    Throws a warning about the "entrypoint" keyword being deprecated
    If the "--no-warning" flag is present, no warning will be shown
*/
rule EntrypointWarning
{
    strings:
        $entry = {AA 0F ?? 3C}
    condition:
        $entry at entrypoint
}
