"""OCI diagnostic: no secrets printed, read-only unless --write-test is given."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
from time import perf_counter
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import patch

from cryptography.hazmat.primitives import serialization
from dotenv import dotenv_values
import oci

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
ALLOWED = ("OCI_USER", "OCI_TENANCY", "OCI_FINGERPRINT", "OCI_REGION",
           "OCI_NAMESPACE", "OCI_BUCKET_NAME")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", required=True, type=Path)
    parser.add_argument("--pem-file", required=True, type=Path)
    parser.add_argument("--write-test", action="store_true",
                        help="Upload two synthetic objects through the real backend adapter, verify and delete them.")
    args = parser.parse_args()
    report = {"fingerprint_matches": False, "bucket_private": False,
              "write_test": "not_requested"}
    started = perf_counter()
    try:
        values = dotenv_values(args.env_file)
        if any(not values.get(name) for name in ALLOWED):
            raise ValueError("missing_required_oci_settings")
        private_key = serialization.load_pem_private_key(args.pem_file.read_bytes(), password=None)
        public_der = private_key.public_key().public_bytes(
            serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        fingerprint = hashlib.md5(public_der, usedforsecurity=False).hexdigest()
        expected = values["OCI_FINGERPRINT"].replace(":", "").lower().strip()
        report["fingerprint_matches"] = fingerprint == expected
        if not report["fingerprint_matches"]:
            raise ValueError("pem_does_not_match_configured_fingerprint")
        for name in ALLOWED:
            os.environ[name] = values[name]
        os.environ["OCI_KEY_FILE"] = str(args.pem_file.resolve())
        # Select supplied credentials, never a different ~/.oci/config silently.
        from app.storage.oci_client import OCIObjectStorageClient
        from app.storage.private_storage import storage_for
        client = OCIObjectStorageClient()
        bucket = client.client.get_bucket(namespace_name=client.namespace,
                                          bucket_name=client.bucket_name).data
        report["bucket_private"] = bucket.public_access_type == "NoPublicAccess"
        if not report["bucket_private"]:
            raise ValueError("bucket_is_not_private_no_user_documents_uploaded")
        report["connection"] = "ok"
        if args.write_test:
            owner = str(uuid4())
            payload = {"test_only": True, "purpose": "OCI storage adapter smoke test", "owner": owner}
            source = "Synthetic OCI storage test. No personal data or AI provider calls."
            solicitud = SimpleNamespace(documento_contenido=source)
            respuesta = SimpleNamespace(model_dump=lambda mode: payload)
            run = uuid4()
            prefix = f"users/{owner}/{run}"
            created = [prefix + "/original.txt", prefix + "/package.json"]
            try:
                with patch("app.storage.private_storage.uuid4", return_value=run):
                    result = storage_for(owner)(solicitud, respuesta)
                assert result.objeto_id == created[1] and result.status_upload == "completado"
                assert client.descargar_objeto(created[0]).decode("utf-8") == source
                assert json.loads(client.descargar_objeto(created[1])) == payload
                report["write_test"] = "upload_and_download_verified"
            finally:
                for name in created:
                    try:
                        client.client.delete_object(namespace_name=client.namespace,
                                                    bucket_name=client.bucket_name, object_name=name)
                    except oci.exceptions.ServiceError as exc:
                        if exc.status != 404:
                            raise
                report["synthetic_objects_removed"] = len(created)
    except oci.exceptions.ServiceError as exc:
        report["error"] = {"type": "OCIServiceError", "status": exc.status, "code": exc.code}
    except Exception as exc:
        report["error"] = {"type": type(exc).__name__}
        if isinstance(exc, ValueError) and str(exc) in {
            "missing_required_oci_settings", "pem_does_not_match_configured_fingerprint",
            "bucket_is_not_private_no_user_documents_uploaded"}:
            report["error"]["reason"] = str(exc)
    report["duration_seconds"] = round(perf_counter() - started, 2)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if "error" in report else 0


if __name__ == "__main__":
    sys.exit(main())
