<?php
require __DIR__ . '/bootstrap.php';

respond(['authenticated' => !empty($_SESSION['authenticated'])]);
