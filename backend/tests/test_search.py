from app.search import search_procedures


def test_synonym_exact_match_scores_one(catalog):
    res = search_procedures("root canal", catalog)
    assert res[0].procedure.code == "D3330"
    assert res[0].score == 1.0


def test_case_insensitive(catalog):
    a = search_procedures("CLEANING", catalog)
    b = search_procedures("cleaning", catalog)
    assert a[0].procedure.code == b[0].procedure.code == "D1110"


def test_substring_match(catalog):
    res = search_procedures("crown", catalog)
    assert res
    assert "D2740" in [m.procedure.code for m in res][:3]


def test_fuzzy_typo(catalog):
    res = search_procedures("rot canal", catalog)
    assert res and res[0].procedure.code == "D3330"


def test_sorted_by_score_desc_and_threshold(catalog):
    res = search_procedures("filling", catalog)
    scores = [m.score for m in res]
    assert scores == sorted(scores, reverse=True)
    assert all(s >= 0.5 for s in scores)
    assert {"D2140", "D2391", "D2392"} <= {m.procedure.code for m in res}


def test_empty_query_returns_all(catalog):
    res = search_procedures("", catalog)
    assert len(res) == len(catalog)
    assert all(m.score == 1 for m in res)


def test_gibberish_returns_nothing(catalog):
    assert search_procedures("zzqxqxzzv", catalog) == []


def test_checkup_finds_exam(catalog):
    assert search_procedures("checkup", catalog)[0].procedure.code == "D0120"
