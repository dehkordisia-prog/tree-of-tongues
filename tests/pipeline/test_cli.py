import pytest

from pipeline.cli import STAGES, build_parser, main


def test_parser_knows_every_stage():
    parser = build_parser()
    for stage in STAGES:
        assert parser.parse_args([stage]).stage == stage


def test_unknown_stage_is_rejected():
    with pytest.raises(SystemExit):
        build_parser().parse_args(["deploy"])


def test_audio_is_a_phase_3_placeholder(capsys):
    assert main(["audio"]) == 0
    assert "Phase 3" in capsys.readouterr().out
