from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.analyzer import AnalyzerResponse, ModlistMod, PrismImportRequest
from app.services import analyzer_service

router = APIRouter(prefix="/analyzer", tags=["analyzer"])


@router.post("/upload", response_model=AnalyzerResponse)
async def upload_mods(files: list[UploadFile] = File(...)) -> AnalyzerResponse:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")
    return await analyzer_service.analyze_files(files)


@router.post("/import-json", response_model=AnalyzerResponse)
async def import_prism_json(request: PrismImportRequest) -> AnalyzerResponse:
    if not request.mods:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No mods in JSON")
    return await analyzer_service.analyze_prism_json(request.mods)


@router.post("/import-modlist", response_model=AnalyzerResponse)
async def import_modlist(mods: list[ModlistMod]) -> AnalyzerResponse:
    if not mods:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No mods in JSON")
    return await analyzer_service.analyze_modlist(mods)
